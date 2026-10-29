/**
 * PAID screen — full-screen green hero, landing-matched detail card.
 * Business logic unchanged.
 */

import { useEffect, useState } from 'react'
import { ExternalLink, RotateCcw } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import SettlLogo from './SettlLogo'
import { formatUsdcDisplay, formatAddress } from '@/lib/amount'
import { explorerTx } from '@/network'
import type { PaidLog } from '@/lib/watcher'
import type { Invoice } from '@/lib/invoice'

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

  const txUrl = explorerTx(paidLog.txHash)
  const wasOverpaid = paidLog.amount > invoice.amount

  // Auto-dismiss ring
  const r = 10
  const circ = 2 * Math.PI * r
  const ringOffset = circ * (1 - remaining / AUTO_DISMISS_SECONDS)

  // Animated check path
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
      {/* Logo — ink on green */}
      <motion.div
        className="mb-8"
        initial={prefersReduced ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SettlLogo height={36} variant="light" />
      </motion.div>

      {/* Check circle */}
      <motion.div
        className="mb-5"
        initial={prefersReduced ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
      >
        <svg width="88" height="88" viewBox="0 0 50 50" fill="none" aria-hidden="true">
          <circle cx="25" cy="25" r="23" stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
          <motion.path
            d={CHECK_PATH}
            stroke="rgba(0,0,0,0.7)"
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
        className="mb-1 font-extrabold tracking-tight"
        style={{ fontSize: '4rem', letterSpacing: '-0.05em', color: '#0B0B0C' }}
        initial={prefersReduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
      >
        PAID
      </motion.h1>

      {/* Amount */}
      <motion.p
        className="mb-1 tabular-nums text-3xl font-bold"
        style={{ letterSpacing: '-0.02em', color: 'rgba(0,0,0,0.7)' }}
        initial={prefersReduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 0.25 }}
      >
        {formatUsdcDisplay(paidLog.amount)}
      </motion.p>

      {wasOverpaid && (
        <p className="mb-2 text-sm" style={{ color: 'rgba(0,0,0,0.5)' }}>
          Invoice was {formatUsdcDisplay(invoice.amount)}
        </p>
      )}

      {/* Detail card — ink-on-surface style matching landing feature cards */}
      <motion.div
        className="mb-6 w-full max-w-xs rounded-3xl p-5"
        style={{ background: 'rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.1)' }}
        initial={prefersReduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.3 }}
      >
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.45)' }}>
              From
            </span>
            <span className="mono text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.75)' }}>
              {formatAddress(paidLog.payer)}
            </span>
          </div>
          {detectedMs !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(0,0,0,0.45)' }}>
                Speed
              </span>
              <span className="text-xs font-semibold" style={{ color: 'rgba(0,0,0,0.75)' }}>
                {detectedMs}ms
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Explorer link */}
      <a
        href={txUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-6 flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-sm font-semibold"
        style={{ background: 'rgba(0,0,0,0.12)', color: 'rgba(0,0,0,0.7)', minHeight: '44px' }}
      >
        View on ArcScan
        <ExternalLink className="h-4 w-4" />
      </a>

      {/* New charge button */}
      <button
        type="button"
        onClick={onNewCharge}
        className="flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold transition-all active:scale-[0.98]"
        style={{ background: '#0B0B0C', color: 'var(--paid)', minHeight: '56px' }}
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
        <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90" aria-hidden="true">
          <circle cx="12" cy="12" r={r} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="2.5" />
          <circle
            cx="12" cy="12" r={r}
            fill="none"
            stroke="rgba(0,0,0,0.4)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={ringOffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <p className="text-xs" style={{ color: 'rgba(0,0,0,0.5)' }}>New charge in {remaining}s</p>
      </motion.div>
    </motion.div>
  )
}
