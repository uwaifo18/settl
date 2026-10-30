/**
 * History screen — premium list with status chips, summary header, empty state, skeleton rows.
 * Business logic unchanged.
 */

import { useEffect, useState } from 'react'
import { ExternalLink, Download, ArrowLeft, CheckCircle, Clock, XCircle, AlertCircle, Receipt } from 'lucide-react'
import SettlLogo from './SettlLogo'
import { loadHistory, exportHistoryCSV } from '@/lib/history'
import { reconcileHistory } from '@/lib/watcher'
import { formatUsdc, formatAddress } from '@/lib/amount'
import { explorerTx } from '@/network'
import type { HistoryEntry } from '@/lib/invoice'

const STATUS_META: Record<HistoryEntry['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  paid:      { label: 'Paid',      color: 'var(--paid)',      bg: 'rgba(53,212,154,0.12)', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  expired:   { label: 'Expired',   color: 'var(--text-muted)', bg: 'var(--surface-raised)', icon: <Clock className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'var(--text-muted)', bg: 'var(--surface-raised)', icon: <XCircle className="h-3.5 w-3.5" /> },
  underpaid: { label: 'Underpaid', color: 'var(--warn)',       bg: 'rgba(232,176,75,0.12)', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  awaiting:  { label: 'Awaiting',  color: 'var(--text-muted)', bg: 'var(--surface-raised)', icon: <Clock className="h-3.5 w-3.5" /> },
}

function StatusChip({ status }: { status: HistoryEntry['status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.awaiting
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.icon}
      {meta.label}
    </span>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-4 animate-pulse" style={{ background: 'var(--surface)' }}>
      <div className="h-8 w-8 rounded-full" style={{ background: 'var(--border)' }} />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded" style={{ background: 'var(--border)' }} />
        <div className="h-2 w-16 rounded" style={{ background: 'var(--border)' }} />
      </div>
      <div className="h-3 w-12 rounded" style={{ background: 'var(--border)' }} />
    </div>
  )
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

interface Props { onBack: () => void }

export default function MerchantHistory({ onBack }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Reconcile stale awaiting entries first, then reload the list
    reconcileHistory()
      .catch(() => { /* best-effort */ })
      .finally(() => {
        void loadHistory().then(h => { setEntries(h); setLoading(false) })
      })
  }, [])

  const [now] = useState(() => Date.now())
  const todayTotal = entries
    .filter(e => e.status === 'paid' && now - e.createdAt < 86400000)
    .reduce((s, e) => s + e.invoice.amount, 0n)
  const todayCount = entries.filter(e => e.status === 'paid' && now - e.createdAt < 86400000).length

  function handleExport() {
    const csv = exportHistoryCSV(entries)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `settl-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-dvh flex-col safe-top safe-bottom" style={{ background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--hairline, #1E1E21)' }}>
        {/* Logo row */}
        <div className="flex items-center justify-center px-5 py-3" style={{ borderBottom: '1px solid var(--hairline, #1E1E21)' }}>
          <SettlLogo height={36} variant="auto" href="/" />
        </div>
        {/* Back + title + export row */}
        <div className="flex items-center gap-3 px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
            style={{ background: 'var(--surface)', minHeight: '44px', minWidth: '44px' }}
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" style={{ color: 'var(--text)' }} />
          </button>
          <h1 className="flex-1 text-base font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>History</h1>
          <button
            type="button"
            onClick={handleExport}
            disabled={entries.length === 0}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', minHeight: '44px' }}
            aria-label="Export CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Today summary */}
      {todayCount > 0 && (
        <div className="mx-5 mt-4 rounded-2xl px-5 py-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Today</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="tabular-nums text-3xl font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
              {formatUsdc(todayTotal)}
            </span>
            <span className="text-lg font-semibold" style={{ color: 'var(--text-muted)' }}>USDC</span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{todayCount} payment{todayCount !== 1 ? 's' : ''}</p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Receipt className="mb-4 h-12 w-12 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>No invoices yet</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Charge your first customer.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map(entry => {
              const meta = STATUS_META[entry.status] ?? STATUS_META.awaiting
              return (
                <li
                  key={entry.invoice.invoiceId}
                  className="flex items-start gap-3 rounded-2xl px-4 py-4"
                  style={{ background: 'var(--surface)', border: '1px solid var(--hairline, #1E1E21)' }}
                >
                  {/* Status icon */}
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="tabular-nums text-base font-bold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
                        {formatUsdc(entry.invoice.amount)} USDC
                      </span>
                      <StatusChip status={entry.status} />
                    </div>
                    {entry.invoice.name && (
                      <p className="truncate text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{entry.invoice.name}</p>
                    )}
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {relativeTime(entry.createdAt)}
                    </p>
                    {entry.payerAddress && (
                      <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        From {formatAddress(entry.payerAddress)}
                      </p>
                    )}
                    {entry.onchainMemo?.note && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--paid)' }}>
                        ⛓ {entry.onchainMemo.note}
                      </p>
                    )}
                  </div>

                  {entry.txHash && (
                    <a
                      href={explorerTx(entry.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: 'var(--surface-raised)', minHeight: '44px', minWidth: '44px' }}
                      aria-label="View transaction"
                    >
                      <ExternalLink className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
