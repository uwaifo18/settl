/**
 * Customer pay page (/pay) — premium redesign.
 * State machine, step indicator, review card.
 * All business logic (validation, allowance, memo wrapper) unchanged.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  useAccount, useSwitchChain, useWriteContract,
  useWaitForTransactionReceipt, useReadContract,
} from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { erc20Abi } from 'viem'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ExternalLink, AlertTriangle, CheckCircle, Copy, ArrowRight } from 'lucide-react'
import TestnetBanner from './TestnetBanner'
import { decodeInvoiceHash, isInvoiceExpired, formatCountdown, secondsUntilDeadline } from '@/lib/invoice'
import { formatUsdcDisplay, formatAddress, LARGE_AMOUNT_THRESHOLD } from '@/lib/amount'
import { buildTxExplorerUrl, buildAddressExplorerUrl } from '@/onchain-facts'
import { MEMO_CONTRACT_ADDRESS, MEMO_ABI, encodeMemoData, encodePayCalldata } from '@/lib/memo'
import SettlLogo from './SettlLogo'

import { IS_MAINNET, activeChain } from '@/config'
const ARC_CHAIN_ID = activeChain.id
const ROUTER_ADDRESS = (
  IS_MAINNET
    ? (import.meta.env.VITE_MAINNET_ROUTER_ADDRESS as string | undefined) ?? ''
    : (import.meta.env.VITE_ROUTER_ADDRESS as string | undefined) ?? '0x6216af3fb64d039b87088f78da38bd641d62b426'
) as `0x${string}`
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

/** Group an address into 4-char readable chunks */
function groupAddress(addr: string) {
  const body = addr.slice(2)
  const chunks: string[] = []
  for (let i = 0; i < body.length; i += 4) chunks.push(body.slice(i, i + 4))
  return '0x ' + chunks.join(' ')
}

function mapRevertError(err: unknown): string {
  const msg = (err as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('expired')) return 'This invoice has expired. Ask the merchant for a new one.'
  if (msg.includes('alreadypaid')) return 'This invoice was already paid.'
  if (msg.includes('zeroa')) return 'The invoice amount is zero.'
  if (msg.includes('invalidmerchant')) return 'Invalid merchant address.'
  if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('4001')) return ''
  if (msg.includes('insufficient')) return 'Insufficient USDC balance.'
  if (msg.includes('callfrom') || msg.includes('precompile') || msg.includes('smart contract wallet'))
    return 'This wallet type is not supported for memo payments. Use MetaMask or Rabby.'
  return 'Transaction failed. Please try again.'
}

type TxPhase = 'idle' | 'approving' | 'pendingApprove' | 'paying' | 'pendingPay' | 'success'

/** Pulsing 3-dot indicator */
function PulsingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0,1,2].map(i => (
        <motion.span key={i} className="inline-block h-1.5 w-1.5 rounded-full bg-white"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  )
}

/** Primary action button — changes label with state */
function ActionButton({ onClick, disabled, phase, isApprovePending, isApproveConfirming,
  isPayPending, isPayConfirming, hasEnoughAllowance, amount }: {
  onClick: () => void; disabled: boolean; phase: TxPhase
  isApprovePending: boolean; isApproveConfirming: boolean
  isPayPending: boolean; isPayConfirming: boolean
  hasEnoughAllowance: boolean; amount: bigint
}) {
  const isWaiting = phase === 'approving' || isApprovePending || phase === 'paying' || isPayPending
  const isConfirming = phase === 'pendingApprove' || isApproveConfirming || phase === 'pendingPay' || isPayConfirming

  let label: React.ReactNode
  if (isWaiting) label = <><PulsingDots /><span className="ml-2">Confirm in wallet…</span></>
  else if (isConfirming) label = <><PulsingDots /><span className="ml-2">{phase === 'pendingApprove' || isApproveConfirming ? 'Approving…' : 'Confirming on Arc…'}</span></>
  else if (!hasEnoughAllowance) label = `Approve ${formatUsdcDisplay(amount)}`
  else label = `Pay ${formatUsdcDisplay(amount)}`

  return (
    <motion.button
      type="button" onClick={onClick} disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className="relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-30"
      style={{ background: 'var(--text)', minHeight: '56px' }}
    >
      <AnimatePresence>
        {isWaiting && (
          <motion.span key="shimmer" className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)', backgroundSize: '200% 100%' }}
            animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.span key={String(isWaiting)+String(isConfirming)+String(hasEnoughAllowance)}
          className="flex items-center justify-center gap-2 px-4"
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.12 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

/** Step indicator for approve → pay flow */
function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 text-xs" role="status" aria-label={`Step ${step} of 2`}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: step === 1 ? 'var(--text)' : 'var(--border)', color: step === 1 ? '#fff' : 'var(--text-muted)' }}>
        1
      </span>
      <span style={{ color: step === 1 ? 'var(--text)' : 'var(--text-muted)' }}>Approve</span>
      <ArrowRight className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: step === 2 ? 'var(--text)' : 'var(--border)', color: step === 2 ? '#fff' : 'var(--text-muted)' }}>
        2
      </span>
      <span style={{ color: step === 2 ? 'var(--text)' : 'var(--text-muted)' }}>Pay</span>
    </div>
  )
}

/** Problem screen — consistent layout */
function ProblemScreen({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col safe-top safe-bottom" style={{ background: 'var(--bg)' }}>
      <TestnetBanner />
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
        <div className="mb-4">{icon}</div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>{title}</h1>
        <p className="mb-6 max-w-xs text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{body}</p>
        {action}
      </div>
    </div>
  )
}

export default function PayPage() {
  const urlHash = window.location.hash
  const { login, logout, authenticated, ready } = usePrivy()
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const prefersReduced = useReducedMotion()

  const [txPhase, setTxPhase] = useState<TxPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [tick, setTick] = useState(0)
  const [addrCopied, setAddrCopied] = useState(false)

  const decodeResult = useMemo(() => {
    if (!urlHash) return null
    return decodeInvoiceHash(urlHash, ROUTER_ADDRESS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlHash])

  const invoice = decodeResult?.ok ? decodeResult.invoice : null

  useEffect(() => {
    if (!invoice) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [invoice])

  const countdown = invoice ? secondsUntilDeadline(invoice) : 0
  void tick

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf',
    args: address ? [address] : undefined, chainId: ARC_CHAIN_ID,
    query: { enabled: !!address && isConnected && chainId === ARC_CHAIN_ID },
  })

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance',
    args: address ? [address, ROUTER_ADDRESS] : undefined, chainId: ARC_CHAIN_ID,
    query: { enabled: !!address && !!ROUTER_ADDRESS && isConnected && chainId === ARC_CHAIN_ID },
  })

  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract()
  const { writeContract: writePay, isPending: isPayPending } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })
  const { isLoading: isPayConfirming, isSuccess: paySuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const effectivePhase = useMemo((): TxPhase => {
    if (paySuccess) return 'success'
    return txPhase
  }, [paySuccess, txPhase])

  const hasEnoughBalance = usdcBalance !== undefined && invoice ? usdcBalance >= invoice.amount : undefined
  const hasEnoughAllowance = allowance !== undefined && invoice ? allowance >= invoice.amount : false

  useEffect(() => {
    if (!approveSuccess || !invoice) return
    refetchAllowance().then(() => setTxPhase('paying')).catch(() => setTxPhase('paying'))
  }, [approveSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePay() {
    if (!invoice || !address) return
    if (isInvoiceExpired(invoice)) return
    setErrorMsg('')
    if (!hasEnoughAllowance) {
      setTxPhase('approving')
      writeApprove({
        address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve',
        args: [ROUTER_ADDRESS, invoice.amount],
      }, {
        onSuccess: (hash) => { setApproveTxHash(hash); setTxPhase('pendingApprove') },
        onError: (err) => { const msg = mapRevertError(err); if (msg) setErrorMsg(msg); setTxPhase('idle') },
      })
      return
    }
    executePay()
  }

  function executePay() {
    if (!invoice || !address) return
    setTxPhase('paying'); setErrorMsg('')
    const payCalldata = encodePayCalldata(invoice.invoiceId, invoice.merchant, invoice.amount, BigInt(invoice.deadline))
    const memoData = encodeMemoData({ invoiceId: invoice.invoiceId, amountUsdc: invoice.amount.toString(), note: invoice.memo })
    writePay({
      address: MEMO_CONTRACT_ADDRESS, abi: MEMO_ABI, functionName: 'memo',
      args: [ROUTER_ADDRESS, payCalldata, invoice.invoiceId, memoData],
    }, {
      onSuccess: (hash) => { setTxHash(hash); setTxPhase('pendingPay') },
      onError: (err) => { const msg = mapRevertError(err); if (msg) setErrorMsg(msg); else setErrorMsg(''); setTxPhase('idle') },
    })
  }

  const txUrl = txHash ? buildTxExplorerUrl(ARC_CHAIN_ID, txHash) : undefined
  const isInvalidLink = decodeResult !== null && !decodeResult.ok && decodeResult.reason !== 'expired'
  const isExpiredLink = (decodeResult !== null && !decodeResult.ok && decodeResult.reason === 'expired') ||
    (invoice !== null && isInvoiceExpired(invoice) && effectivePhase === 'idle')
  const parseError = decodeResult !== null && !decodeResult.ok ? decodeResult.message : ''

  // Success screen
  if (effectivePhase === 'success') {
    return (
      <div className="flex min-h-dvh flex-col safe-top safe-bottom" style={{ background: 'var(--bg)' }}>
        <TestnetBanner />
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center">
          <motion.div
            initial={prefersReduced ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
            className="mb-5"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'rgba(53,212,154,0.15)' }}>
              <CheckCircle className="h-10 w-10" style={{ color: 'var(--paid)' }} />
            </div>
          </motion.div>
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
            Payment sent
          </h1>
          {invoice && (
            <p className="mb-1 tabular-nums text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>
              {formatUsdcDisplay(invoice.amount)}
            </p>
          )}
          <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>Settled on Arc Testnet</p>
          {txUrl && (
            <a href={txUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}>
              View on ArcScan <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    )
  }

  if (isExpiredLink) return (
    <ProblemScreen
      icon={<div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.1)' }}>
        <AlertTriangle className="h-7 w-7" style={{ color: 'var(--danger)' }} />
      </div>}
      title="Link expired"
      body="This payment link has expired. Ask the merchant to generate a new invoice."
    />
  )

  if (isInvalidLink) return (
    <ProblemScreen
      icon={<div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.1)' }}>
        <AlertTriangle className="h-7 w-7" style={{ color: 'var(--danger)' }} />
      </div>}
      title="Invalid link"
      body={parseError || 'This payment link is invalid or incomplete.'}
    />
  )

  const wrongNetwork = isConnected && chainId !== ARC_CHAIN_ID
  const needsWallet = !isConnected
  const currentStep: 1 | 2 = hasEnoughAllowance ? 2 : 1

  return (
    <div className="flex min-h-dvh flex-col safe-top safe-bottom" style={{ background: 'var(--bg)' }}>
      <TestnetBanner />

      <div className="flex flex-1 flex-col items-center px-5 py-6">
        <div className="w-full max-w-sm space-y-4">

          {/* Logo + title */}
          <div className="flex flex-col items-center text-center">
            <SettlLogo height={24} />
            <h1 className="mt-3 text-xl font-bold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
              {invoice?.name ?? 'Payment request'}
            </h1>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>Arc Testnet</p>
          </div>

          {/* Invoice review card */}
          {invoice && (
            <div className="rounded-3xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              {/* Amount */}
              <div className="text-center">
                <div className="tabular-nums text-5xl font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
                  {formatUsdcDisplay(invoice.amount)}
                </div>
                {invoice.amount > LARGE_AMOUNT_THRESHOLD && (
                  <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--warn)' }}>
                    Large amount — verify the merchant carefully
                  </p>
                )}
              </div>

              <div className="h-px" style={{ background: 'var(--border)' }} />

              {/* Details */}
              <div className="space-y-3">
                {/* Merchant address */}
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Paying to</p>
                  <div className="flex items-start justify-between gap-3">
                    <p className="mono break-all text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                      {groupAddress(invoice.merchant)}
                    </p>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(invoice.merchant).then(() => {
                            setAddrCopied(true)
                            setTimeout(() => setAddrCopied(false), 2000)
                          }).catch(() => {})
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl transition-all active:scale-95"
                        style={{ background: 'var(--surface-raised)' }}
                        aria-label="Copy address"
                      >
                        <Copy className="h-3.5 w-3.5" style={{ color: addrCopied ? 'var(--paid)' : 'var(--text-muted)' }} />
                      </button>
                      <a
                        href={buildAddressExplorerUrl(ARC_CHAIN_ID, invoice.merchant)}
                        target="_blank" rel="noopener noreferrer"
                        className="flex h-8 w-8 items-center justify-center rounded-xl"
                        style={{ background: 'var(--surface-raised)' }}
                        aria-label="View on explorer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
                      </a>
                    </div>
                  </div>
                </div>

                {invoice.memo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Note</span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{invoice.memo}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Expires</span>
                  <span className="mono text-xs font-semibold" style={{ color: countdown < 60 ? 'var(--danger)' : 'var(--text)' }}>
                    {formatCountdown(countdown)}
                  </span>
                </div>

                {usdcBalance !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Your balance</span>
                    <span className="mono text-xs font-semibold" style={{ color: hasEnoughBalance === false ? 'var(--danger)' : 'var(--text)' }}>
                      {formatUsdcDisplay(usdcBalance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Low balance */}
          {hasEnoughBalance === false && (
            <div className="flex items-start gap-2 rounded-2xl p-4" style={{ background: 'rgba(232,176,75,0.1)', border: '1px solid var(--warn)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--warn)' }} />
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                Insufficient USDC balance.{' '}
                <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="underline">Get testnet USDC</a>
              </p>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-2xl p-4" style={{ background: 'rgba(242,107,107,0.1)', border: '1px solid var(--danger)' }}>
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
              <p className="text-sm" style={{ color: 'var(--text)' }}>{errorMsg}</p>
            </div>
          )}

          {/* Privy not ready */}
          {!ready && (
            <div className="flex justify-center py-4">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--text-muted)', borderTopColor: 'transparent' }} />
            </div>
          )}

          {/* Connect wallet */}
          {ready && needsWallet && (
            <button type="button" onClick={login}
              className="w-full rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.98]"
              style={{ background: 'var(--text)', minHeight: '56px' }}>
              Connect wallet
            </button>
          )}

          {/* Wrong network */}
          {ready && wrongNetwork && (
            <button type="button" onClick={() => switchChain({ chainId: ARC_CHAIN_ID })}
              disabled={isSwitching}
              className="w-full rounded-2xl py-4 text-base font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--text)', minHeight: '56px' }}>
              {isSwitching ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Switching…
                </span>
              ) : 'Switch to Arc Testnet'}
            </button>
          )}

          {/* Pay flow */}
          {ready && isConnected && !wrongNetwork && invoice && (
            <div className="space-y-3">
              {!hasEnoughAllowance && txPhase === 'idle' && (
                <div className="flex justify-center">
                  <StepIndicator step={currentStep} />
                </div>
              )}
              <ActionButton
                onClick={hasEnoughAllowance ? executePay : handlePay}
                disabled={
                  hasEnoughBalance === false ||
                  txPhase === 'pendingPay' || txPhase === 'approving' || txPhase === 'pendingApprove' ||
                  isApprovePending || isApproveConfirming || isPayPending || isPayConfirming
                }
                phase={txPhase}
                isApprovePending={isApprovePending}
                isApproveConfirming={isApproveConfirming}
                isPayPending={isPayPending}
                isPayConfirming={isPayConfirming}
                hasEnoughAllowance={hasEnoughAllowance}
                amount={invoice.amount}
              />
            </div>
          )}

          {/* Connected wallet footer */}
          {authenticated && isConnected && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {address ? formatAddress(address) : ''}
              </span>
              <button type="button" onClick={() => void logout()}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
                style={{ background: 'var(--surface)', color: 'var(--text-muted)', minHeight: '36px' }}>
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
