/**
 * Customer pay page (/pay).
 * State machine: parsing → invalid | expired | needsWallet → wrongNetwork → review → (approve) → confirm → pending → success | failed
 */

import { useState, useEffect, useMemo } from 'react'
import {
  useAccount,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { erc20Abi } from 'viem'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react'
import TestnetBanner from './TestnetBanner'
import { decodeInvoiceHash, isInvoiceExpired, formatCountdown, secondsUntilDeadline } from '@/lib/invoice'
import { formatUsdcDisplay, formatAddress, LARGE_AMOUNT_THRESHOLD } from '@/lib/amount'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { MEMO_CONTRACT_ADDRESS, MEMO_ABI, encodeMemoData, encodePayCalldata } from '@/lib/memo'

const ARC_TESTNET_CHAIN_ID = 5042002
// Fallback to the deployed address if env var is not set at build time
const ROUTER_ADDRESS = (
  import.meta.env.VITE_ROUTER_ADDRESS || '0x6216af3fb64d039b87088f78da38bd641d62b426'
) as `0x${string}`
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

function InlineError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl p-4" style={{ background: '#fee2e2', border: '1px solid #fecaca' }}>
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: 'var(--danger)' }} />
      <p className="text-sm" style={{ color: '#991b1b' }}>{message}</p>
    </div>
  )
}

function mapRevertError(err: unknown): string {
  const msg = (err as Error)?.message?.toLowerCase() ?? ''
  if (msg.includes('expired')) return 'This invoice has expired. Ask the merchant for a new one.'
  if (msg.includes('alreadypaid')) return 'This invoice was already paid.'
  if (msg.includes('zeroa')) return 'The invoice amount is zero.'
  if (msg.includes('invalidmerchant')) return 'Invalid merchant address.'
  if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('4001')) return ''
  if (msg.includes('insufficient')) return 'Insufficient USDC balance. Get testnet USDC from faucet.circle.com.'
  if (msg.includes('callfrom') || msg.includes('precompile') || msg.includes('smart contract wallet'))
    return 'This wallet type is not supported for memo payments. Please use MetaMask or Rabby.'
  return 'Transaction failed. Please try again.'
}

type TxPhase = 'idle' | 'approving' | 'pendingApprove' | 'paying' | 'pendingPay' | 'success'

function PulsingDots() {
  return (
    <span className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-white"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

function PayButton({
  onClick, disabled, phase, isApprovePending, isApproveConfirming,
  isPayPending, isPayConfirming, hasEnoughAllowance, amount,
}: {
  onClick: () => void
  disabled: boolean
  phase: TxPhase
  isApprovePending: boolean
  isApproveConfirming: boolean
  isPayPending: boolean
  isPayConfirming: boolean
  hasEnoughAllowance: boolean
  amount: bigint
}) {
  const isWaiting = phase === 'approving' || isApprovePending || phase === 'paying' || isPayPending
  const isConfirming = phase === 'pendingApprove' || isApproveConfirming || phase === 'pendingPay' || isPayConfirming

  let label: React.ReactNode
  if (isWaiting) {
    label = <><PulsingDots /><span className="ml-2">Check your wallet</span></>
  } else if (isConfirming) {
    label = <><PulsingDots /><span className="ml-2">{phase === 'pendingApprove' || isApproveConfirming ? 'Approving…' : 'Confirming…'}</span></>
  } else if (!hasEnoughAllowance) {
    label = `Approve ${formatUsdcDisplay(amount)}`
  } else {
    label = `Pay ${formatUsdcDisplay(amount)}`
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.97 }}
      whileHover={disabled ? {} : { scale: 1.01 }}
      className="relative w-full overflow-hidden rounded-2xl text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: 'var(--accent)', minHeight: '56px' }}
    >
      {/* Shimmer sweep when waiting for wallet */}
      <AnimatePresence>
        {isWaiting && (
          <motion.span
            key="shimmer"
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <motion.span
          key={String(isWaiting) + String(isConfirming) + String(hasEnoughAllowance)}
          className="flex items-center justify-center gap-2 px-4 py-4"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
        >
          {label}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}

export default function PayPage() {
  const urlHash = window.location.hash
  const { login, logout, authenticated, ready } = usePrivy()
  const { address, chainId, isConnected } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const [txPhase, setTxPhase] = useState<TxPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [tick, setTick] = useState(0)

  // Decode invoice from hash
  const decodeResult = useMemo(() => {
    if (!urlHash) return null
    return decodeInvoiceHash(urlHash, ROUTER_ADDRESS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlHash])

  const invoice = decodeResult?.ok ? decodeResult.invoice : null

  // Countdown timer — only drives re-render for the countdown display
  useEffect(() => {
    if (!invoice) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [invoice])

  // Derived countdown value (no setState, just reading during render)
  const countdown = invoice ? secondsUntilDeadline(invoice) : 0
  // tick is used to force re-render for the countdown; suppress unused warning
  void tick

  // USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && isConnected && chainId === ARC_TESTNET_CHAIN_ID },
  })

  // USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, ROUTER_ADDRESS] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && !!ROUTER_ADDRESS && isConnected && chainId === ARC_TESTNET_CHAIN_ID },
  })

  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract()
  const { writeContract: writePay, isPending: isPayPending } = useWriteContract()

  // Wait for approve tx
  const { isLoading: isApproveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTxHash })

  // Wait for pay tx
  const { isLoading: isPayConfirming, isSuccess: paySuccess } = useWaitForTransactionReceipt({ hash: txHash })

  // Derived state: what is the effective pay phase?
  const effectivePhase = useMemo((): TxPhase => {
    if (paySuccess) return 'success'
    return txPhase
  }, [paySuccess, txPhase])

  const hasEnoughBalance = usdcBalance !== undefined && invoice ? usdcBalance >= invoice.amount : undefined
  const hasEnoughAllowance = allowance !== undefined && invoice ? allowance >= invoice.amount : false

  // When approve confirms, refetch allowance and move to paying
  useEffect(() => {
    if (!approveSuccess || !invoice) return
    refetchAllowance().then(() => {
      setTxPhase('paying')
    }).catch(() => { setTxPhase('paying') })
  }, [approveSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePay() {
    if (!invoice || !address) return
    if (isInvoiceExpired(invoice)) return
    setErrorMsg('')

    if (!hasEnoughAllowance) {
      setTxPhase('approving')
      writeApprove({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ROUTER_ADDRESS, invoice.amount],
      }, {
        onSuccess: (hash) => {
          setApproveTxHash(hash)
          setTxPhase('pendingApprove')
        },
        onError: (err) => {
          const msg = mapRevertError(err)
          if (msg) setErrorMsg(msg)
          setTxPhase('idle')
        },
      })
      return
    }

    executePay()
  }

  function executePay() {
    if (!invoice || !address) return
    setTxPhase('paying')
    setErrorMsg('')

    // Build Memo-wrapped call: Memo.memo(router, pay(...), invoiceId, memoData)
    const payCalldata = encodePayCalldata(
      invoice.invoiceId,
      invoice.merchant,
      invoice.amount,
      BigInt(invoice.deadline),
    )
    const memoData = encodeMemoData({
      invoiceId: invoice.invoiceId,
      amountUsdc: invoice.amount.toString(),
      note: invoice.memo,
    })

    writePay({
      address: MEMO_CONTRACT_ADDRESS,
      abi: MEMO_ABI,
      functionName: 'memo',
      args: [ROUTER_ADDRESS, payCalldata, invoice.invoiceId, memoData],
    }, {
      onSuccess: (hash) => {
        setTxHash(hash)
        setTxPhase('pendingPay')
      },
      onError: (err) => {
        const msg = mapRevertError(err)
        if (msg) setErrorMsg(msg)
        else setErrorMsg('')
        setTxPhase('idle')
      },
    })
  }

  const txUrl = txHash ? buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, txHash) : undefined

  // -- Derived display state --
  const isInvalidLink = decodeResult !== null && !decodeResult.ok && decodeResult.reason !== 'expired'
  const isExpiredLink = (decodeResult !== null && !decodeResult.ok && decodeResult.reason === 'expired') ||
    (invoice !== null && isInvoiceExpired(invoice) && effectivePhase === 'idle')
  const parseError = decodeResult !== null && !decodeResult.ok ? decodeResult.message : ''

  // Success screen
  if (effectivePhase === 'success') {
    return (
      <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg-gradient)' }}>
        <TestnetBanner />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
          <CheckCircle className="mb-4 h-16 w-16" style={{ color: 'var(--success)' }} />
          <h1 className="display mb-2 text-3xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Payment Sent
          </h1>
          {invoice && (
            <p className="mb-4 text-lg font-semibold" style={{ color: 'var(--muted)' }}>
              {formatUsdcDisplay(invoice.amount)}
            </p>
          )}
          {txUrl && (
            <a
              href={txUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}
            >
              View on ArcScan <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    )
  }

  // Expired screen
  if (isExpiredLink) {
    return (
      <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg-gradient)' }}>
        <TestnetBanner />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <AlertTriangle className="mb-4 h-12 w-12" style={{ color: 'var(--danger)' }} />
          <h1 className="display mb-2 text-2xl font-bold" style={{ color: 'var(--ink)' }}>Link Expired</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>
            This payment link has expired. Ask the merchant to generate a new invoice.
          </p>
        </div>
      </div>
    )
  }

  // Invalid screen
  if (isInvalidLink) {
    return (
      <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg-gradient)' }}>
        <TestnetBanner />
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 text-center">
          <AlertTriangle className="mb-4 h-12 w-12" style={{ color: 'var(--danger)' }} />
          <h1 className="display mb-2 text-2xl font-bold" style={{ color: 'var(--ink)' }}>Invalid Link</h1>
          <p className="mb-6 text-sm" style={{ color: 'var(--muted)' }}>{parseError || 'This payment link is invalid or incomplete.'}</p>
        </div>
      </div>
    )
  }

  const wrongNetwork = isConnected && chainId !== ARC_TESTNET_CHAIN_ID
  const needsWallet = !isConnected

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg-gradient)' }}>
      <TestnetBanner />

      <div className="flex flex-1 flex-col items-center px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          {/* Header */}
          <div className="text-center">
            <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {invoice?.name ?? 'Payment Request'}
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Arc Testnet</p>
          </div>

          {/* Invoice card */}
          {invoice && (
            <div className="rounded-3xl p-5" style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}>
              {/* Amount */}
              <div className="mb-4 text-center">
                <div className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
                  {formatUsdcDisplay(invoice.amount)}
                </div>
                {invoice.amount > LARGE_AMOUNT_THRESHOLD && (
                  <p className="mt-1 text-xs font-semibold" style={{ color: '#92400e' }}>
                    Large amount — verify the merchant carefully
                  </p>
                )}
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>To</span>
                  <div className="text-right">
                    <div className="mono text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
                      {invoice.merchant}
                    </div>
                    <div className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                      {formatAddress(invoice.merchant)}
                    </div>
                  </div>
                </div>

                {invoice.memo && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Note</span>
                    <span className="text-xs" style={{ color: 'var(--ink-2)' }}>{invoice.memo}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>Expires</span>
                  <span className="mono text-xs" style={{ color: countdown < 60 ? 'var(--danger)' : 'var(--ink-2)' }}>
                    {formatCountdown(countdown)}
                  </span>
                </div>

                {usdcBalance !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>Your balance</span>
                    <span className="mono text-xs font-semibold" style={{ color: hasEnoughBalance === false ? 'var(--danger)' : 'var(--ink-2)' }}>
                      {formatUsdcDisplay(usdcBalance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Low balance warning */}
          {hasEnoughBalance === false && (
            <div className="rounded-xl p-3 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>
              Insufficient USDC balance.{' '}
              <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="underline">
                Get testnet USDC
              </a>
            </div>
          )}

          {/* Error */}
          {errorMsg && <InlineError message={errorMsg} />}

          {/* Connect wallet */}
          {!ready ? (
            <div className="flex items-center justify-center py-4">
              <motion.span
                className="inline-block h-5 w-5 rounded-full border-2 border-t-transparent"
                style={{ borderColor: 'var(--muted)', borderTopColor: 'transparent' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : needsWallet && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to pay</p>
              <button
                type="button"
                onClick={login}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
                style={{ background: 'var(--accent)', minHeight: '56px' }}
              >
                Connect Wallet
              </button>
            </div>
          )}

          {/* Wrong network */}
          {wrongNetwork && (
            <button
              type="button"
              onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
              disabled={isSwitching}
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--accent)' }}
            >
              {isSwitching ? (
                <span className="flex items-center gap-2">
                  <motion.span
                    className="inline-block h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  Switching...
                </span>
              ) : 'Switch to Arc Testnet'}
            </button>
          )}

          {/* Pay buttons — only when connected, right network, have invoice */}
          {isConnected && !wrongNetwork && invoice && (
            <div className="space-y-2">
              {/* Step indicator when approve is needed */}
              {!hasEnoughAllowance && txPhase === 'idle' && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--surface-muted)' }}>1</span>
                  Approve USDC
                  <ArrowRight className="h-3 w-3 mx-1" />
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--surface-muted)' }}>2</span>
                  Confirm payment
                </div>
              )}

              <PayButton
                onClick={hasEnoughAllowance ? executePay : handlePay}
                disabled={
                  hasEnoughBalance === false ||
                  txPhase === 'pendingPay' ||
                  txPhase === 'approving' ||
                  txPhase === 'pendingApprove' ||
                  isApprovePending ||
                  isApproveConfirming ||
                  isPayPending ||
                  isPayConfirming
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

          {/* Connected wallet info */}
          {authenticated && isConnected && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                Connected: {address ? formatAddress(address) : ''}
              </span>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl px-3 py-1.5 text-xs font-medium"
                style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
