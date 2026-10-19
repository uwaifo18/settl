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
import { ConnectKitButton } from 'connectkit'
import { erc20Abi } from 'viem'
import { ExternalLink, AlertTriangle, CheckCircle, Loader2, ArrowRight } from 'lucide-react'
import TestnetBanner from './TestnetBanner'
import { decodeInvoiceHash, isInvoiceExpired, formatCountdown, secondsUntilDeadline } from '@/lib/invoice'
import { formatUsdcDisplay, formatAddress, LARGE_AMOUNT_THRESHOLD } from '@/lib/amount'
import { buildTxExplorerUrl } from '@/onchain-facts'
import {
  MEMO_CONTRACT_ADDRESS,
  MEMO_ABI,
  encodeMemoData,
  encodePayCalldata,
} from '@/lib/memo'

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
  return 'Transaction failed. Please try again.'
}

type TxPhase = 'idle' | 'approving' | 'pendingApprove' | 'paying' | 'pendingPay' | 'success'

export default function PayPage() {
  const urlHash = window.location.hash
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
        chainId: ARC_TESTNET_CHAIN_ID,
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

    // Encode ArcTapRouter.pay() calldata for the Memo wrapper
    const payCalldata = encodePayCalldata(
      invoice.invoiceId,
      invoice.merchant,
      invoice.amount,
      BigInt(invoice.deadline)
    )

    // Encode memo payload: business name + note stored permanently onchain
    const memoData = encodeMemoData({
      businessName: invoice.name,
      note: invoice.memo,
      invoiceId: invoice.invoiceId,
      amountUsdc: (Number(invoice.amount) / 1_000_000).toFixed(6),
    })

    // Call Memo.memo(router, payCalldata, invoiceId, memoData)
    // This wraps router.pay() and emits a Memo event with the invoice metadata,
    // preserving msg.sender so the router still sees the customer as payer.
    writePay({
      address: MEMO_CONTRACT_ADDRESS,
      abi: MEMO_ABI,
      functionName: 'memo',
      args: [ROUTER_ADDRESS, payCalldata, invoice.invoiceId, memoData],
      chainId: ARC_TESTNET_CHAIN_ID,
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
          {needsWallet && (
            <div className="text-center">
              <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to pay</p>
              <ConnectKitButton />
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
              {isSwitching ? <><Loader2 className="h-4 w-4 animate-spin" /> Switching...</> : 'Switch to Arc Testnet'}
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

              <button
                type="button"
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
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--accent)', minHeight: '56px' }}
              >
                {txPhase === 'approving' || isApprovePending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Confirm in wallet...</>
                ) : txPhase === 'pendingApprove' || isApproveConfirming ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Approving USDC...</>
                ) : txPhase === 'paying' || isPayPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Confirm in wallet...</>
                ) : txPhase === 'pendingPay' || isPayConfirming ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Confirming on Arc...</>
                ) : !hasEnoughAllowance ? (
                  `Approve ${formatUsdcDisplay(invoice.amount)}`
                ) : (
                  `Pay ${formatUsdcDisplay(invoice.amount)}`
                )}
              </button>
            </div>
          )}

          {/* Connected wallet info */}
          {isConnected && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--subtle)' }}>
                Connected: {address ? formatAddress(address) : ''}
              </span>
              <ConnectKitButton />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
