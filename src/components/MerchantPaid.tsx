/**
 * PAID screen — signature moment, animated check-draw, auto-dismiss ring.
 * Business logic unchanged.
 */

import { useEffect, useState } from 'react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { formatUsdcDisplay, formatAddress } from '@/lib/amount'
import { buildTxExplorerUrl } from '@/onchain-facts'
import type { PaidLog } from '@/lib/watcher'
import type { Invoice } from '@/lib/invoice'

const ARC_TESTNET_CHAIN_ID = 5042002
const AUTO_DISMISS_SECONDS = 30

interface Props {
  invoice: Invoice
  paidLog: PaidLog
  detectedMs?: number
  onNewCharge: () => void
}

export default function MerchantPaid({ invoice, paidLog, detectedMs, onNewCharge }: Props) {
  const [remaining, setRemaining] = useState(AUTO_DISMISS_SECONDS)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(s => {
        if (s <= 1) { clearInterval(interval); onNewCharge(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [onNewCharge])

  const txUrl = buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, paidLog.txHash)
  const wasOverpaid = paidLog.amount > invoice.amount

  // Countdown ring
  const r = 10
  const circ = 2 * Math.PI * r
  const ringOffset = circ * (1 - remaining / AUTO_DISMISS_SECONDS)

  // Check mark path — draws itself
  const CHECK_PATH = 'M 12 24 L 22 34 L 38 16'

  return (
    <motion.div
      className="flex min-h-dvh flex-col items-center justify-center px-5 py-10 safe-top safe-bottom"
      style={{ background: 'var(--paid)' }}
      initial={prefersReduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      aria-live="assertive"
      aria-label="Payment received"
    >
      {/* Animated check circle */}
      <motion.div
        className="mb-6"
        initial={prefersReduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
      >
        <svg width="96" height="96" viewBox="0 0 50 50" fill="none">
          <circle cx="25" cy="25" r="23" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
          <motion.path
            d={CHECK_PATH}
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            initial={prefersReduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, delay: 0.15, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>

      {/* PAID */}
      <motion.h1
        className="mb-2 text-6xl font-extrabold tracking-tight text-white"
        style={{ letterSpacing: '-0.04em' }}
        initial={prefersReduced ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
      >
        PAID
      </motion.h1>

      {/* Amount */}
      <motion.p
        className="mb-1 tabular-nums text-3xl font-bold text-white/90"
        style={{ letterSpacing: '-0.02em' }}
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.25 }}
      >
        {formatUsdcDisplay(paidLog.amount)}
      </motion.p>

      {wasOverpaid && (
        <p className="mb-2 text-sm text-white/70">
          Invoice was {formatUsdcDisplay(invoice.amount)}
        </p>
      )}

      {/* Payer */}
      <motion.div
        className="mb-6 text-center"
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.3 }}
      >
        <p className="text-sm text-white/60">From</p>
        <p className="mono text-sm font-semibold text-white">{formatAddress(paidLog.payer)}</p>
        {detectedMs !== undefined && (
          <p className="mt-0.5 text-xs text-white/50">Detected {detectedMs}ms after block</p>
        )}
      </motion.div>

      {/* Explorer */}
      <a
        href={txUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-8 flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white/90"
        style={{ background: 'rgba(0,0,0,0.18)', minHeight: '44px' }}
      >
        View on ArcScan
        <ExternalLink className="h-4 w-4" />
      </a>

      {/* New charge */}
      <button
        type="button"
        onClick={onNewCharge}
        className="flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold transition-all active:scale-[0.98]"
        style={{ background: '#fff', color: 'var(--paid-light)', minHeight: '56px' }}
      >
        <RotateCcw className="h-5 w-5" />
        New charge
      </button>

      {/* Auto-dismiss ring */}
      <motion.div
        className="mt-5 flex items-center gap-2"
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
          <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" />
          <circle
            cx="12" cy="12" r={r}
            fill="none"
            stroke="rgba(255,255,255,0.7)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={ringOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <p className="text-xs text-white/60">New charge in {remaining}s</p>
      </motion.div>
    </motion.div>
  )
}
