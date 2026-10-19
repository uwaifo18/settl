/**
 * Full-screen PAID confirmation screen.
 * Shown after onchain event is verified against the invoice.
 */

import { motion } from 'framer-motion'
import { CheckCircle, ExternalLink, RotateCcw } from 'lucide-react'
import { formatUsdcDisplay, formatAddress } from '@/lib/amount'
import { buildTxExplorerUrl } from '@/onchain-facts'
import type { PaidLog } from '@/lib/watcher'
import type { Invoice } from '@/lib/invoice'

const ARC_TESTNET_CHAIN_ID = 5042002

interface Props {
  invoice: Invoice
  paidLog: PaidLog
  detectedMs?: number
  onNewCharge: () => void
}

export default function MerchantPaid({ invoice, paidLog, detectedMs, onNewCharge }: Props) {
  const txUrl = buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, paidLog.txHash)
  const wasOverpaid = paidLog.amount > invoice.amount

  return (
    <motion.div
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-8"
      style={{ background: '#16a34a' }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      aria-live="assertive"
      aria-label="Payment received"
    >
      {/* Check icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
        className="mb-6"
      >
        <CheckCircle className="h-24 w-24 text-white" strokeWidth={1.5} />
      </motion.div>

      {/* PAID label */}
      <motion.h1
        className="display mb-2 text-5xl font-bold text-white"
        style={{ letterSpacing: '-0.02em' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        PAID
      </motion.h1>

      {/* Amount */}
      <motion.p
        className="display mb-1 text-2xl font-semibold text-white/90"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        {formatUsdcDisplay(paidLog.amount)}
      </motion.p>

      {/* Overpaid note */}
      {wasOverpaid && (
        <p className="mb-2 text-sm text-white/75">
          (Invoice was {formatUsdcDisplay(invoice.amount)})
        </p>
      )}

      {/* Payer */}
      <motion.div
        className="mb-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-sm text-white/70">From</p>
        <p className="mono text-sm font-semibold text-white">{formatAddress(paidLog.payer)}</p>
      </motion.div>

      {/* Detection time */}
      {detectedMs !== undefined && (
        <p className="mb-4 text-xs text-white/60">
          Detected {detectedMs}ms after block
        </p>
      )}

      {/* Explorer link */}
      <a
        href={txUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-8 flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white/90 underline-offset-4 hover:underline"
        style={{ background: 'rgba(0,0,0,0.15)' }}
      >
        View on ArcScan
        <ExternalLink className="h-4 w-4" />
      </a>

      {/* New charge button */}
      <button
        type="button"
        onClick={onNewCharge}
        className="flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ color: '#16a34a' }}
      >
        <RotateCcw className="h-5 w-5" />
        New charge
      </button>
    </motion.div>
  )
}
