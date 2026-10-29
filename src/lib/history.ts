/**
 * IndexedDB invoice history using idb-keyval.
 * Stores up to 500 entries per network. Testnet and mainnet records never mix.
 */

import { get, set } from 'idb-keyval'
import type { HistoryEntry } from './invoice'
import { NETWORK } from '@/network'

/** Key is network-scoped so testnet and mainnet records never mix. */
const HISTORY_KEY = `settl:history:v2:${NETWORK}`
const MAX_ENTRIES = 500

export async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const stored = await get<HistoryEntry[]>(HISTORY_KEY)
    return stored ?? []
  } catch {
    return []
  }
}

export async function saveHistoryEntry(entry: HistoryEntry): Promise<void> {
  const history = await loadHistory()

  // Idempotent: update existing entry by invoiceId
  const idx = history.findIndex(h => h.invoice.invoiceId === entry.invoice.invoiceId)
  if (idx >= 0) {
    history[idx] = entry
  } else {
    history.unshift(entry) // newest first
    if (history.length > MAX_ENTRIES) {
      history.splice(MAX_ENTRIES)
    }
  }

  await set(HISTORY_KEY, history)
}

export async function updateHistoryEntry(
  invoiceId: `0x${string}`,
  updates: Partial<HistoryEntry>
): Promise<void> {
  const history = await loadHistory()
  const idx = history.findIndex(h => h.invoice.invoiceId === invoiceId)
  if (idx >= 0) {
    history[idx] = { ...history[idx], ...updates }
    await set(HISTORY_KEY, history)
  }
}

export async function clearHistory(): Promise<void> {
  await set(HISTORY_KEY, [])
}

/**
 * Export history as CSV string.
 * Columns: date, network, status, amount (USDC), merchant, payer, tx_hash, invoice_id
 */
export function exportHistoryCSV(history: HistoryEntry[]): string {
  const header = 'date,network,status,amount_usdc,merchant,payer,tx_hash,invoice_id\n'
  const rows = history.map(h => {
    const date = new Date(h.createdAt).toISOString()
    const amount = h.invoice.amount ? (Number(h.invoice.amount) / 1_000_000).toFixed(6) : ''
    return [
      date,
      h.invoice.network ?? NETWORK,
      h.status,
      amount,
      h.invoice.merchant,
      h.payerAddress ?? '',
      h.txHash ?? '',
      h.invoice.invoiceId,
    ].join(',')
  })
  return header + rows.join('\n')
}
