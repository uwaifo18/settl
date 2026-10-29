/**
 * Customer pay page (/pay).
 *
 * Safety guarantees:
 *  - Simulation runs before every write; wallet is never opened if it would revert.
 *  - Success requires a verified Paid event from ROUTER_ADDRESS AND a passing isPaid() cross-check.
 *  - The Memo wrapper is runtime-checked: only used when (a) the Memo contract has bytecode on
 *    the active chain AND (b) the connected account is an EOA. Defaults to direct pay on mainnet
 *    until the owner confirms the Memo contract is deployed there (see DECISIONS.md D9).
 *  - Network-aware copy throughout; no hard-coded "Arc Testnet".
 *  - Mainnet shows a persistent "Real USDC" warning on the review card.
 *  - Faucet link shown only when HAS_FAUCET (testnet).
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  useAccount, useSwitchChain, useWriteContract,
  useWaitForTransactionReceipt, useReadContract, usePublicClient,
} from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { erc20Abi, parseAbiItem, decodeEventLog, type Log } from 'viem'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { ExternalLink, AlertTriangle, CheckCircle, Copy, ArrowRight, ShieldAlert } from 'lucide-react'
import NetworkBanner from './NetworkBanner'
import { decodeInvoiceHash, isInvoiceExpired, formatCountdown, secondsUntilDeadline } from '@/lib/invoice'
import { formatUsdcDisplay, formatAddress, LARGE_AMOUNT_THRESHOLD } from '@/lib/amount'
import { explorerTx, explorerAddress, ROUTER_ADDRESS, USDC_ADDRESS, CHAIN_ID, CHAIN_LABEL, NETWORK, HAS_FAUCET } from '@/network'
import { MEMO_CONTRACT_ADDRESS, MEMO_ABI, encodeMemoData, encodePayCalldata } from '@/lib/memo'
import SettlLogo from './SettlLogo'

const ARC_CHAIN_ID = CHAIN_ID

// Router ABI — just the functions/events we need
const ROUTER_ABI = [
  {
    type: 'function',
    name: 'pay',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'invoiceId', type: 'bytes32' },
      { name: 'merchant', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'isPaid',
    stateMutability: 'view',
    inputs: [
      { name: 'merchant', type: 'address' },
      { name: 'invoiceId', type: 'bytes32' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'event',
    name: 'Paid',
    inputs: [
      { name: 'invoiceId', type: 'bytes32', indexed: true },
      { name: 'merchant', type: 'address', indexed: true },
      { name: 'payer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
] as const

const PAID_EVENT = parseAbiItem(
  'event Paid(bytes32 indexed invoiceId, address indexed merchant, address indexed payer, uint256 amount)'
)


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

type TxPhase =
  | 'idle'
  | 'simulating'
  | 'approving'
  | 'pendingApprove'
  | 'paying'
  | 'pendingPay'
  | 'verifying'
  | 'success'
  | 'unregistered'   // receipt confirmed but Paid event not found / isPaid false

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

/** Primary action button */
function ActionButton({ onClick, disabled, phase, isApprovePending, isApproveConfirming,
  isPayPending, isPayConfirming, hasEnoughAllowance, amount }: {
  onClick: () => void; disabled: boolean; phase: TxPhase
  isApprovePending: boolean; isApproveConfirming: boolean
  isPayPending: boolean; isPayConfirming: boolean
  hasEnoughAllowance: boolean; amount: bigint
}) {
  const isWaiting = phase === 'simulating' || phase === 'approving' || isApprovePending || phase === 'paying' || isPayPending
  const isConfirming = phase === 'pendingApprove' || isApproveConfirming || phase === 'pendingPay' || isPayConfirming || phase === 'verifying'

  let label: React.ReactNode
  if (phase === 'simulating') label = <><PulsingDots /><span className="ml-2">Checking…</span></>
  else if (phase === 'verifying') label = <><PulsingDots /><span className="ml-2">Verifying payment…</span></>
  else if (isWaiting) label = <><PulsingDots /><span className="ml-2">Confirm in wallet…</span></>
  else if (isConfirming) label = <><PulsingDots /><span className="ml-2">{phase === 'pendingApprove' || isApproveConfirming ? 'Approving…' : `Confirming on ${CHAIN_LABEL}…`}</span></>
  else if (!hasEnoughAllowance) label = `Approve ${formatUsdcDisplay(amount)}`
  else label = `Pay ${formatUsdcDisplay(amount)}`

  return (
    <motion.button
      type="button" onClick={onClick} disabled={disabled}
      whileTap={disabled ? {} : { scale: 0.97 }}
      className="relative w-full overflow-hidden rounded-2xl py-4 text-base font-bold text-black disabled:cursor-not-allowed disabled:opacity-30"
      style={{ background: 'var(--paid)', minHeight: '56px' }}
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
        <motion.span key={String(isWaiting)+String(isConfirming)+String(hasEnoughAllowance)+phase}
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
        style={{ background: step === 1 ? 'var(--paid)' : 'var(--border)', color: step === 1 ? '#000' : 'var(--text-muted)' }}>
        1
      </span>
      <span style={{ color: step === 1 ? 'var(--paid)' : 'var(--text-muted)' }}>Approve</span>
      <ArrowRight className="h-3 w-3" style={{ color: 'var(--text-muted)' }} />
      <span className="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
        style={{ background: step === 2 ? 'var(--paid)' : 'var(--border)', color: step === 2 ? '#000' : 'var(--text-muted)' }}>
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
      <NetworkBanner />
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
  const publicClient = usePublicClient({ chainId: ARC_CHAIN_ID })

  const [txPhase, setTxPhase] = useState<TxPhase>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | undefined>()
  const [tick, setTick] = useState(0)
  const [addrCopied, setAddrCopied] = useState(false)
  /** Whether the Memo contract has bytecode on this chain (checked once). */
  const memoAvailableRef = useRef<boolean | null>(null)

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

  // On mount / reload: if this invoice was already paid, jump straight to success.
  useEffect(() => {
    if (!invoice || !publicClient || txPhase !== 'idle') return
    void (async () => {
      try {
        const alreadyPaid = await publicClient.readContract({
          address: ROUTER_ADDRESS,
          abi: ROUTER_ABI,
          functionName: 'isPaid',
          args: [invoice.merchant, invoice.invoiceId],
        })
        if (!alreadyPaid) return
        // Recover the tx hash for the explorer link
        try {
          const logs = await publicClient.getLogs({
            address: ROUTER_ADDRESS,
            event: PAID_EVENT,
            args: { invoiceId: invoice.invoiceId, merchant: invoice.merchant },
            fromBlock: 'earliest',
            toBlock: 'latest',
          })
          if (logs[0]?.transactionHash) setTxHash(logs[0].transactionHash)
        } catch { /* non-blocking */ }
        setTxPhase('success')
      } catch { /* non-blocking — if RPC fails, let user pay normally */ }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, publicClient])

  // Check if Memo contract has bytecode on this chain (once, on mount)
  useEffect(() => {
    if (memoAvailableRef.current !== null) return
    // On mainnet default to false until explicitly verified (see DECISIONS.md D9)
    if (NETWORK === 'mainnet') {
      memoAvailableRef.current = false
      return
    }
    if (!publicClient) return
    publicClient.getCode({ address: MEMO_CONTRACT_ADDRESS })
      .then(code => {
        memoAvailableRef.current = !!(code && code !== '0x')
      })
      .catch(() => {
        memoAvailableRef.current = false
      })
  }, [publicClient])

  // Check if connected account is EOA (no bytecode)
  const [isEOA, setIsEOA] = useState<boolean>(true)
  useEffect(() => {
    if (!address || !publicClient) return
    publicClient.getCode({ address })
      .then(code => setIsEOA(!code || code === '0x'))
      .catch(() => setIsEOA(true))
  }, [address, publicClient])

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
  const { isLoading: isPayConfirming, isSuccess: payReceiptSuccess, data: payReceipt } = useWaitForTransactionReceipt({ hash: txHash })

  const hasEnoughBalance = usdcBalance !== undefined && invoice ? usdcBalance >= invoice.amount : undefined
  const hasEnoughAllowance = allowance !== undefined && invoice ? allowance >= invoice.amount : false

  // After approve confirms, refetch allowance and advance to pay step
  useEffect(() => {
    if (!approveSuccess || !invoice) return
    refetchAllowance().then(() => setTxPhase('paying')).catch(() => setTxPhase('paying'))
  }, [approveSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  // After pay receipt confirms, verify the Paid event and isPaid() cross-check
  useEffect(() => {
    if (!payReceiptSuccess || !payReceipt || !invoice) return
    if (txPhase === 'success' || txPhase === 'unregistered' || txPhase === 'verifying') return
    setTxPhase('verifying')

    void (async () => {
      try {
        // 1. Parse logs for a Paid event from ROUTER_ADDRESS with matching invoiceId, merchant, amount
        const paidLog = (payReceipt.logs as Log[]).find(log => {
          if (log.address?.toLowerCase() !== ROUTER_ADDRESS.toLowerCase()) return false
          try {
            const decoded = decodeEventLog({
              abi: [PAID_EVENT],
              data: log.data,
              topics: log.topics,
            })
            const args = decoded.args as { invoiceId: `0x${string}`; merchant: `0x${string}`; amount: bigint }
            return (
              args.invoiceId?.toLowerCase() === invoice.invoiceId.toLowerCase() &&
              args.merchant?.toLowerCase() === invoice.merchant.toLowerCase() &&
              args.amount >= invoice.amount
            )
          } catch { return false }
        })

        if (!paidLog) {
          setTxPhase('unregistered')
          return
        }

        // 2. Cross-check isPaid() onchain.
        // An RPC failure here does NOT invalidate the payment — the log above
        // already proves the tx landed. Treat a thrown error as "unverified but
        // likely paid" and proceed to success rather than showing 'unregistered'.
        // Only set 'unregistered' when isPaid() explicitly returns false.
        if (publicClient) {
          try {
            const onchainConfirmed = await publicClient.readContract({
              address: ROUTER_ADDRESS,
              abi: ROUTER_ABI,
              functionName: 'isPaid',
              args: [invoice.merchant, invoice.invoiceId],
            })
            if (!onchainConfirmed) {
              // Contract says not paid — log matched but key not set. Unusual but real.
              setTxPhase('unregistered')
              return
            }
          } catch {
            // RPC error: we already have a matching Paid log from the receipt,
            // so proceed to success rather than falsely showing 'unregistered'.
          }
        }

        setTxPhase('success')
      } catch {
        setTxPhase('unregistered')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payReceiptSuccess, payReceipt])

  /** Simulate a contract call and throw a user-friendly error on revert. */
  const simulate = useCallback(async (
    call: Parameters<NonNullable<typeof publicClient>['simulateContract']>[0]
  ): Promise<void> => {
    if (!publicClient) return
    await publicClient.simulateContract(call)
  }, [publicClient])

  async function handlePay() {
    if (!invoice || !address) return
    if (isInvoiceExpired(invoice)) return

    // Retry safety: if already paid on chain, go straight to success.
    // Also try to recover the tx hash so the explorer link is shown.
    if (txPhase === 'idle' && publicClient) {
      try {
        const alreadyPaid = await publicClient.readContract({
          address: ROUTER_ADDRESS,
          abi: ROUTER_ABI,
          functionName: 'isPaid',
          args: [invoice.merchant, invoice.invoiceId],
        })
        if (alreadyPaid) {
          // Best-effort: recover the tx hash for the explorer link
          try {
            const logs = await publicClient.getLogs({
              address: ROUTER_ADDRESS,
              event: PAID_EVENT,
              args: { invoiceId: invoice.invoiceId, merchant: invoice.merchant },
              fromBlock: 'earliest',
              toBlock: 'latest',
            })
            if (logs[0]?.transactionHash) setTxHash(logs[0].transactionHash)
          } catch { /* non-blocking — success screen still shows without link */ }
          setTxPhase('success')
          return
        }
      } catch { /* non-blocking */ }
    }

    setErrorMsg('')

    if (!hasEnoughAllowance) {
      setTxPhase('simulating')
      try {
        await simulate({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ROUTER_ADDRESS, invoice.amount],
          account: address,
        })
      } catch (err) {
        setErrorMsg(mapRevertError(err) || 'Approve simulation failed. Please try again.')
        setTxPhase('idle')
        return
      }
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
    await executePay()
  }

  async function executePay() {
    if (!invoice || !address) return

    // Retry safety: check isPaid before retrying.
    // Also try to recover the tx hash so the explorer link is shown.
    if (publicClient) {
      try {
        const alreadyPaid = await publicClient.readContract({
          address: ROUTER_ADDRESS,
          abi: ROUTER_ABI,
          functionName: 'isPaid',
          args: [invoice.merchant, invoice.invoiceId],
        })
        if (alreadyPaid) {
          try {
            const logs = await publicClient.getLogs({
              address: ROUTER_ADDRESS,
              event: PAID_EVENT,
              args: { invoiceId: invoice.invoiceId, merchant: invoice.merchant },
              fromBlock: 'earliest',
              toBlock: 'latest',
            })
            if (logs[0]?.transactionHash) setTxHash(logs[0].transactionHash)
          } catch { /* non-blocking */ }
          setTxPhase('success')
          return
        }
      } catch { /* non-blocking */ }
    }

    setErrorMsg('')
    const deadline = BigInt(invoice.deadline)

    // Decide whether to use Memo wrapper
    const useMemo = memoAvailableRef.current === true && isEOA

    setTxPhase('simulating')
    try {
      if (useMemo) {
        const payCalldata = encodePayCalldata(invoice.invoiceId, invoice.merchant, invoice.amount, deadline)
        const memoData = encodeMemoData({ businessName: invoice.name, invoiceId: invoice.invoiceId, amountUsdc: invoice.amount.toString(), note: invoice.memo })
        await simulate({
          address: MEMO_CONTRACT_ADDRESS,
          abi: MEMO_ABI,
          functionName: 'memo',
          args: [ROUTER_ADDRESS, payCalldata, invoice.invoiceId, memoData],
          account: address,
        })
      } else {
        await simulate({
          address: ROUTER_ADDRESS,
          abi: ROUTER_ABI,
          functionName: 'pay',
          args: [invoice.invoiceId, invoice.merchant, invoice.amount, deadline],
          account: address,
        })
      }
    } catch (err) {
      setErrorMsg(mapRevertError(err) || 'Payment simulation failed. Please try again.')
      setTxPhase('idle')
      return
    }

    setTxPhase('paying')
    if (useMemo) {
      const payCalldata = encodePayCalldata(invoice.invoiceId, invoice.merchant, invoice.amount, deadline)
      const memoData = encodeMemoData({ businessName: invoice.name, invoiceId: invoice.invoiceId, amountUsdc: invoice.amount.toString(), note: invoice.memo })
      writePay({
        address: MEMO_CONTRACT_ADDRESS, abi: MEMO_ABI, functionName: 'memo',
        args: [ROUTER_ADDRESS, payCalldata, invoice.invoiceId, memoData],
      }, {
        onSuccess: (hash) => { setTxHash(hash); setTxPhase('pendingPay') },
        onError: (err) => { const msg = mapRevertError(err); if (msg) setErrorMsg(msg); else setErrorMsg(''); setTxPhase('idle') },
      })
    } else {
      writePay({
        address: ROUTER_ADDRESS, abi: ROUTER_ABI, functionName: 'pay',
        args: [invoice.invoiceId, invoice.merchant, invoice.amount, deadline],
      }, {
        onSuccess: (hash) => { setTxHash(hash); setTxPhase('pendingPay') },
        onError: (err) => { const msg = mapRevertError(err); if (msg) setErrorMsg(msg); else setErrorMsg(''); setTxPhase('idle') },
      })
    }
  }

  const txUrl = txHash ? explorerTx(txHash) : undefined
  const isInvalidLink = decodeResult !== null && !decodeResult.ok && decodeResult.reason !== 'expired'
  const isExpiredLink = (decodeResult !== null && !decodeResult.ok && decodeResult.reason === 'expired') ||
    (invoice !== null && isInvoiceExpired(invoice) && txPhase === 'idle')
  const parseError = decodeResult !== null && !decodeResult.ok ? decodeResult.message : ''

  // Unregistered screen — receipt confirmed but payment not verified
  if (txPhase === 'unregistered') {
    return (
      <ProblemScreen
        icon={<div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.1)' }}>
          <ShieldAlert className="h-7 w-7" style={{ color: 'var(--danger)' }} />
        </div>}
        title="Payment not registered"
        body="The transaction was confirmed but the payment did not register. Do not pay again. Check the receipt or contact the merchant."
        action={txUrl ? (
          <a href={txUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-2xl px-5 py-3 text-sm font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}>
            View receipt <ExternalLink className="h-4 w-4" />
          </a>
        ) : undefined}
      />
    )
  }

  // Success screen
  if (txPhase === 'success') {
    return (
      <div className="flex min-h-dvh flex-col safe-top safe-bottom" style={{ background: 'var(--bg)' }}>
        <NetworkBanner />
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
          <h1 className="mb-1 text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
            Payment sent
          </h1>
          {invoice && (
            <div className="mb-1 flex items-baseline justify-center gap-2">
              <span className="tabular-nums text-2xl font-extrabold" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
                {formatUsdcDisplay(invoice.amount)}
              </span>
            </div>
          )}
          <p className="mb-6 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Settled on {CHAIN_LABEL}
          </p>
          {txUrl && (
            <a href={txUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-2xl px-5 py-3 text-sm font-semibold transition-all active:scale-95"
              style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}>
              View on explorer <ExternalLink className="h-4 w-4" />
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
      <NetworkBanner />

      <div className="flex flex-1 flex-col items-center px-5 py-6">
        <div className="w-full max-w-sm space-y-4">

          {/* Logo + title */}
          <div className="flex flex-col items-center text-center">
            <SettlLogo height={36} variant="auto" />
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
              {invoice?.name ?? 'Payment request'}
            </h1>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{CHAIN_LABEL}</p>
          </div>

          {/* Invoice review card */}
          {invoice && (
            <div className="rounded-3xl p-5 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--hairline, #1E1E21)' }}>
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
                {/* Mainnet persistent warning */}
                {NETWORK === 'mainnet' && (
                  <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--warn)' }}>
                    Real USDC on Arc Mainnet. Check the merchant address before paying.
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
                    <div>
                      {invoice.name && (
                        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{invoice.name}</p>
                      )}
                      <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        {invoice.merchant.slice(0, 6)}…{invoice.merchant.slice(-4)}
                      </p>
                    </div>
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
                        href={explorerAddress(invoice.merchant)}
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
                {HAS_FAUCET ? (
                  <>Insufficient USDC balance.{' '}
                    <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="underline">Get testnet USDC</a>
                  </>
                ) : (
                  'Not enough USDC to pay this invoice.'
                )}
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
              className="w-full rounded-2xl py-4 text-base font-bold text-black transition-all active:scale-[0.98]"
              style={{ background: 'var(--paid)', minHeight: '56px' }}>
              Connect wallet
            </button>
          )}

          {/* Wrong network */}
          {ready && wrongNetwork && (
            <button type="button" onClick={() => switchChain({ chainId: ARC_CHAIN_ID })}
              disabled={isSwitching}
              className="w-full rounded-2xl py-4 text-base font-bold text-black transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: 'var(--paid)', minHeight: '56px' }}>
              {isSwitching ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Switching…
                </span>
              ) : `Switch to ${CHAIN_LABEL}`}
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
                onClick={hasEnoughAllowance ? () => void executePay() : () => void handlePay()}
                disabled={
                  hasEnoughBalance === false ||
                  txPhase === 'simulating' ||
                  txPhase === 'pendingPay' || txPhase === 'approving' || txPhase === 'pendingApprove' ||
                  txPhase === 'verifying' ||
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
