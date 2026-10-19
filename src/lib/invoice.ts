/**
 * Invoice creation, encoding, decoding, and validation.
 * All invoice params travel in the URL hash fragment so they never hit server logs.
 */

import { isAddress } from 'viem'

export const ARC_TESTNET_CHAIN_ID = 5042002

export interface Invoice {
  v: 1
  invoiceId: `0x${string}`      // 32 random bytes
  merchant: `0x${string}`       // receiving address
  amount: bigint                 // micro-USDC (6 decimals)
  deadline: number               // unix seconds
  name?: string                  // business name, max 32 chars
  memo?: string                  // memo, max 64 chars
  chainId: 5042002
  createdBlock?: bigint          // merchant-side only, for log backfill
  routerAddress: `0x${string}`   // baked-in router address
}

export type InvoiceStatus =
  | 'awaiting'
  | 'paid'
  | 'expired'
  | 'underpaid'
  | 'cancelled'

export interface HistoryEntry {
  invoice: Invoice
  status: InvoiceStatus
  paidAmount?: bigint
  payerAddress?: `0x${string}`
  txHash?: `0x${string}`
  detectedMs?: number            // ms since block timestamp when detected
  createdAt: number              // unix ms
  settledAt?: number             // unix ms
}

/** Generate 32 cryptographically random bytes as a 0x-prefixed hex string */
export function randomInvoiceId(): `0x${string}` {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return ('0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`
}

/** Create an invoice client-side, never touching a server */
export function createInvoice(params: {
  merchant: `0x${string}`
  amount: bigint
  routerAddress: `0x${string}`
  name?: string
  memo?: string
  deadlineSeconds?: number       // default 600 (10 min)
}): Invoice {
  const now = Math.floor(Date.now() / 1000)
  return {
    v: 1,
    invoiceId: randomInvoiceId(),
    merchant: params.merchant,
    amount: params.amount,
    deadline: now + (params.deadlineSeconds ?? 600),
    name: params.name?.slice(0, 32),
    memo: params.memo?.slice(0, 64),
    chainId: ARC_TESTNET_CHAIN_ID,
    routerAddress: params.routerAddress,
  }
}

/** Encode invoice as URL hash fragment params */
export function encodeInvoiceHash(invoice: Invoice): string {
  const params = new URLSearchParams()
  params.set('v', '1')
  params.set('r', invoice.routerAddress)
  params.set('m', invoice.merchant)
  params.set('a', invoice.amount.toString())
  params.set('i', invoice.invoiceId)
  params.set('d', invoice.deadline.toString())
  params.set('c', invoice.chainId.toString())
  if (invoice.name) params.set('n', invoice.name)
  if (invoice.memo) params.set('t', invoice.memo)
  return params.toString()
}

/** Build the full pay URL for a given base URL */
export function buildPayUrl(baseUrl: string, invoice: Invoice): string {
  return `${baseUrl}/pay#${encodeInvoiceHash(invoice)}`
}

export interface DecodeResult {
  ok: true
  invoice: Invoice
}

export interface DecodeError {
  ok: false
  reason: 'missing_param' | 'bad_address' | 'bad_amount' | 'bad_chain' | 'bad_invoice_id' | 'expired' | 'bad_router' | 'bad_deadline'
  message: string
}

/**
 * Decode and validate invoice from URL hash fragment.
 * bakedinRouterAddress: the router address baked into the build — never trust URL's r param.
 */
export function decodeInvoiceHash(hash: string, bakedInRouterAddress: `0x${string}`): DecodeResult | DecodeError {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(raw)

  const r = params.get('r')
  const m = params.get('m')
  const a = params.get('a')
  const i = params.get('i')
  const d = params.get('d')
  const c = params.get('c')
  const n = params.get('n')
  const t = params.get('t')

  // Validate version
  if (params.get('v') !== '1') {
    return { ok: false, reason: 'missing_param', message: 'Invalid or missing invoice version.' }
  }

  // Validate router — MUST equal baked-in address, never trust URL
  if (!r || !isAddress(r)) {
    return { ok: false, reason: 'bad_address', message: 'Invalid router address in link.' }
  }
  if (r.toLowerCase() !== bakedInRouterAddress.toLowerCase()) {
    return { ok: false, reason: 'bad_router', message: 'This payment link points to an unrecognised contract. Do not pay.' }
  }

  // Validate merchant address
  if (!m || !isAddress(m)) {
    return { ok: false, reason: 'bad_address', message: 'Invalid merchant address.' }
  }

  // Validate amount
  if (!a || !/^\d+$/.test(a)) {
    return { ok: false, reason: 'bad_amount', message: 'Invalid payment amount.' }
  }
  const amount = BigInt(a)
  if (amount <= 0n) {
    return { ok: false, reason: 'bad_amount', message: 'Payment amount must be greater than zero.' }
  }

  // Validate invoice ID (32 bytes = 64 hex chars + 0x prefix)
  if (!i || !/^0x[0-9a-fA-F]{64}$/.test(i)) {
    return { ok: false, reason: 'bad_invoice_id', message: 'Invalid invoice ID.' }
  }

  // Validate deadline
  if (!d || !/^\d+$/.test(d)) {
    return { ok: false, reason: 'bad_deadline', message: 'Invalid deadline.' }
  }
  const deadline = parseInt(d, 10)
  const now = Math.floor(Date.now() / 1000)
  if (deadline <= now) {
    return { ok: false, reason: 'expired', message: 'This payment link has expired.' }
  }

  // Validate chain ID
  if (!c || parseInt(c, 10) !== ARC_TESTNET_CHAIN_ID) {
    return { ok: false, reason: 'bad_chain', message: `This link is for a different network (expected Arc Testnet, chain ${ARC_TESTNET_CHAIN_ID}).` }
  }

  // Cap name/memo lengths
  const name = n ? n.slice(0, 32) : undefined
  const memo = t ? t.slice(0, 64) : undefined

  return {
    ok: true,
    invoice: {
      v: 1,
      invoiceId: i as `0x${string}`,
      merchant: m,
      amount,
      deadline,
      name,
      memo,
      chainId: ARC_TESTNET_CHAIN_ID,
      routerAddress: r,
    },
  }
}

export function isInvoiceExpired(invoice: Invoice): boolean {
  return Math.floor(Date.now() / 1000) > invoice.deadline
}

export function secondsUntilDeadline(invoice: Invoice): number {
  return Math.max(0, invoice.deadline - Math.floor(Date.now() / 1000))
}

export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Expired'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
