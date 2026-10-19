/**
 * History screen: list of past invoices with status, amount, time, tx link.
 * IndexedDB-backed, up to 500 entries, CSV export.
 */

import { useEffect, useState } from 'react'
import { ExternalLink, Download, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { loadHistory, exportHistoryCSV } from '@/lib/history'
import { formatUsdc, formatAddress } from '@/lib/amount'
import { buildTxExplorerUrl } from '@/onchain-facts'
import type { HistoryEntry } from '@/lib/invoice'

const ARC_TESTNET_CHAIN_ID = 5042002

interface Props {
  onBack: () => void
}

function StatusIcon({ status }: { status: HistoryEntry['status'] }) {
  switch (status) {
    case 'paid': return <CheckCircle className="h-4 w-4" style={{ color: 'var(--success)' }} />
    case 'expired': return <Clock className="h-4 w-4" style={{ color: 'var(--subtle)' }} />
    case 'cancelled': return <XCircle className="h-4 w-4" style={{ color: 'var(--subtle)' }} />
    case 'underpaid': return <AlertCircle className="h-4 w-4" style={{ color: '#f59e0b' }} />
    default: return <Clock className="h-4 w-4" style={{ color: 'var(--subtle)' }} />
  }
}

export default function MerchantHistory({ onBack }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadHistory().then(h => { setEntries(h); setLoading(false) })
  }, [])

  function handleExport() {
    const csv = exportHistoryCSV(entries)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `arctap-history-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <button type="button" onClick={onBack} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          &larr; Back
        </button>
        <h2 className="display text-base font-bold" style={{ color: 'var(--ink)' }}>History</h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={entries.length === 0}
          className="flex items-center gap-1 text-sm font-medium disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
          aria-label="Export CSV"
        >
          <Download className="h-4 w-4" />
          CSV
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="mx-auto mb-3 h-10 w-10 opacity-30" style={{ color: 'var(--muted)' }} />
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No payment history yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map(entry => (
              <li
                key={entry.invoice.invoiceId}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
              >
                <StatusIcon status={entry.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="display text-base font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                      ${formatUsdc(entry.invoice.amount)}
                    </span>
                    <span className="text-xs font-medium capitalize" style={{ color: 'var(--muted)' }}>
                      {entry.status}
                    </span>
                  </div>
                  {entry.invoice.name && (
                    <p className="truncate text-xs" style={{ color: 'var(--subtle)' }}>{entry.invoice.name}</p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--subtle)' }}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  {entry.payerAddress && (
                    <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                      From: {formatAddress(entry.payerAddress)}
                    </p>
                  )}
                </div>
                {entry.txHash && (
                  <a
                    href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, entry.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                    aria-label="View transaction"
                  >
                    <ExternalLink className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
