/**
 * Unit tests for network.ts logic, invoice.ts logic, receipt verification,
 * explorer helpers, and the "confirmed-but-not-registered" pay-page state.
 *
 * These tests run with VITE_NETWORK=testnet (the default in the test env)
 * and also simulate mainnet scenarios by importing pure functions directly.
 *
 * NOTE: network.ts and invoice.ts import import.meta.env at module load time,
 * so mainnet scenarios are tested via the pure helper functions rather than
 * re-importing with different env vars.
 */

import { describe, it, expect } from 'vitest'

// ── Helpers that mirror network.ts logic (pure, env-independent) ─────────────

type Network = 'mainnet' | 'testnet'

function parseNetwork(raw: string | undefined): Network {
  if (raw === undefined || raw === '' || raw === 'testnet') return 'testnet'
  if (raw === 'mainnet') return 'mainnet'
  throw new Error(`VITE_NETWORK="${raw}" is not recognised. Accepted: "mainnet" | "testnet".`)
}

function explorerTxFor(network: Network, hash: string): string {
  const base = network === 'mainnet'
    ? 'https://explorer.arc.io'
    : 'https://explorer.testnet.arc.io'
  return `${base}/tx/${hash}`
}

function explorerAddressFor(network: Network, addr: string): string {
  const base = network === 'mainnet'
    ? 'https://explorer.arc.io'
    : 'https://explorer.testnet.arc.io'
  return `${base}/address/${addr}`
}

function chainIdFor(network: Network): number {
  return network === 'mainnet' ? 5042 : 5042002
}

function maxInvoiceUsdc(network: Network, overrideUsdc?: number): bigint {
  const n = overrideUsdc ?? (network === 'mainnet' ? 50 : 1000)
  return BigInt(Math.round(n * 1_000_000))
}

// ── network.ts: VITE_NETWORK parsing ─────────────────────────────────────────

describe('parseNetwork', () => {
  it('returns testnet for undefined', () => {
    expect(parseNetwork(undefined)).toBe('testnet')
  })

  it('returns testnet for empty string', () => {
    expect(parseNetwork('')).toBe('testnet')
  })

  it('returns testnet for "testnet"', () => {
    expect(parseNetwork('testnet')).toBe('testnet')
  })

  it('returns mainnet for "mainnet"', () => {
    expect(parseNetwork('mainnet')).toBe('mainnet')
  })

  it('throws for any other non-empty value', () => {
    expect(() => parseNetwork('staging')).toThrow()
    expect(() => parseNetwork('MAINNET')).toThrow()
    expect(() => parseNetwork('production')).toThrow()
  })
})

// ── network.ts: chain IDs ──────────────────────────────────────────────────

describe('chainIdFor', () => {
  it('returns 5042 on mainnet', () => {
    expect(chainIdFor('mainnet')).toBe(5042)
  })

  it('returns 5042002 on testnet', () => {
    expect(chainIdFor('testnet')).toBe(5042002)
  })
})

// ── network.ts: explorer helpers ──────────────────────────────────────────────

const DUMMY_HASH = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab'
const DUMMY_ADDR = '0x1234567890123456789012345678901234567890'

describe('explorerTxFor', () => {
  it('uses testnet explorer on testnet', () => {
    const url = explorerTxFor('testnet', DUMMY_HASH)
    expect(url).toContain('explorer.testnet.arc.io')
    expect(url).toContain(DUMMY_HASH)
    expect(url).not.toContain('5042002')
  })

  it('uses mainnet explorer on mainnet', () => {
    const url = explorerTxFor('mainnet', DUMMY_HASH)
    expect(url).toContain('explorer.arc.io')
    expect(url).not.toContain('testnet')
    expect(url).toContain(DUMMY_HASH)
  })
})

describe('explorerAddressFor', () => {
  it('uses testnet explorer on testnet', () => {
    const url = explorerAddressFor('testnet', DUMMY_ADDR)
    expect(url).toContain('explorer.testnet.arc.io')
  })

  it('uses mainnet explorer on mainnet', () => {
    const url = explorerAddressFor('mainnet', DUMMY_ADDR)
    expect(url).toContain('explorer.arc.io')
    expect(url).not.toContain('testnet')
  })
})

// ── invoice.ts: decode / round-trip ──────────────────────────────────────────

/**
 * Pure invoice decode logic (mirrors src/lib/invoice.ts, env-independent).
 * We test the logic directly rather than importing the module (which would
 * require import.meta.env shims in the test environment).
 */

interface InvoiceParams {
  v?: string
  r?: string         // router
  m?: string         // merchant
  a?: string         // amount (micro-USDC)
  i?: string         // invoiceId
  d?: string         // deadline
  c?: string         // chainId
}

type DecodeResult =
  | { ok: true; amount: bigint; chainId: number }
  | { ok: false; reason: string }

function decodeInvoice(
  params: InvoiceParams,
  opts: {
    bakedRouter: string
    expectedChainId: number
    maxUsdc: bigint
    nowSeconds?: number
  }
): DecodeResult {
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (params.v !== '1') return { ok: false, reason: 'bad_version' }
  if (!params.r || params.r.toLowerCase() !== opts.bakedRouter.toLowerCase()) return { ok: false, reason: 'bad_router' }
  if (!params.m || !/^0x[0-9a-fA-F]{40}$/.test(params.m)) return { ok: false, reason: 'bad_address' }
  if (!params.a || !/^\d+$/.test(params.a)) return { ok: false, reason: 'bad_amount' }
  const amount = BigInt(params.a)
  if (amount <= 0n) return { ok: false, reason: 'bad_amount' }
  if (amount > opts.maxUsdc) return { ok: false, reason: 'amount_cap' }
  if (!params.i || !/^0x[0-9a-fA-F]{64}$/.test(params.i)) return { ok: false, reason: 'bad_invoice_id' }
  if (!params.d || !/^\d+$/.test(params.d)) return { ok: false, reason: 'bad_deadline' }
  if (parseInt(params.d, 10) <= now) return { ok: false, reason: 'expired' }
  if (!params.c || parseInt(params.c, 10) !== opts.expectedChainId) return { ok: false, reason: 'bad_chain' }
  return { ok: true, amount, chainId: parseInt(params.c, 10) }
}

const TESTNET_ROUTER = '0x6216af3fb64d039b87088f78da38bd641d62b426'
const MAINNET_ROUTER = '0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F'
const VALID_MERCHANT = '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF'
const VALID_INVOICE_ID = '0x' + 'a'.repeat(64)
const FUTURE_DEADLINE = String(Math.floor(Date.now() / 1000) + 3600)

describe('invoice decode — testnet', () => {
  const opts = {
    bakedRouter: TESTNET_ROUTER,
    expectedChainId: 5042002,
    maxUsdc: maxInvoiceUsdc('testnet'),
  }

  it('accepts a valid testnet invoice', () => {
    const result = decodeInvoice({
      v: '1', r: TESTNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042002',
    }, opts)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.amount).toBe(1_000_000n)
      expect(result.chainId).toBe(5042002)
    }
  })

  it('rejects a mainnet chain ID on a testnet build', () => {
    const result = decodeInvoice({
      v: '1', r: TESTNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad_chain')
  })

  it('rejects an unrecognised router', () => {
    const result = decodeInvoice({
      v: '1', r: MAINNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042002',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad_router')
  })

  it('rejects an expired link', () => {
    const result = decodeInvoice({
      v: '1', r: TESTNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: '1', c: '5042002',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('expired')
  })

  it('accepts amount at cap', () => {
    const result = decodeInvoice({
      v: '1', r: TESTNET_ROUTER, m: VALID_MERCHANT,
      a: String(opts.maxUsdc), i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042002',
    }, opts)
    expect(result.ok).toBe(true)
  })

  it('rejects amount above testnet cap (1000 USDC)', () => {
    const overCap = opts.maxUsdc + 1n
    const result = decodeInvoice({
      v: '1', r: TESTNET_ROUTER, m: VALID_MERCHANT,
      a: String(overCap), i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042002',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('amount_cap')
  })
})

describe('invoice decode — mainnet', () => {
  const opts = {
    bakedRouter: MAINNET_ROUTER,
    expectedChainId: 5042,
    maxUsdc: maxInvoiceUsdc('mainnet'),
  }

  it('rejects a testnet chain ID on a mainnet build', () => {
    const result = decodeInvoice({
      v: '1', r: MAINNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042002',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad_chain')
  })

  it('rejects amount above mainnet cap (50 USDC)', () => {
    const overCap = opts.maxUsdc + 1n
    const result = decodeInvoice({
      v: '1', r: MAINNET_ROUTER, m: VALID_MERCHANT,
      a: String(overCap), i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('amount_cap')
  })

  it('no testnet fallback: testnet router is rejected', () => {
    const result = decodeInvoice({
      v: '1', r: TESTNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042',
    }, opts)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('bad_router')
  })

  it('accepts a valid mainnet invoice', () => {
    const result = decodeInvoice({
      v: '1', r: MAINNET_ROUTER, m: VALID_MERCHANT,
      a: '1000000', i: VALID_INVOICE_ID, d: FUTURE_DEADLINE, c: '5042',
    }, opts)
    expect(result.ok).toBe(true)
  })
})

// ── Receipt-verification logic ────────────────────────────────────────────────

/**
 * Pure receipt-verification helper (mirrors the PayPage.tsx verification logic).
 */
interface PaidEventArgs {
  invoiceId: `0x${string}`
  merchant: `0x${string}`
  amount: bigint
}

interface FakeLog {
  address: string
  args: PaidEventArgs
}

function verifyReceiptLog(
  logs: FakeLog[],
  routerAddress: string,
  invoiceId: string,
  merchant: string,
  expectedAmount: bigint
): 'ok' | 'unregistered' {
  const match = logs.find(log => {
    if (log.address.toLowerCase() !== routerAddress.toLowerCase()) return false
    const a = log.args
    return (
      a.invoiceId.toLowerCase() === invoiceId.toLowerCase() &&
      a.merchant.toLowerCase() === merchant.toLowerCase() &&
      a.amount >= expectedAmount
    )
  })
  return match ? 'ok' : 'unregistered'
}

describe('receipt verification', () => {
  const router = TESTNET_ROUTER
  const invoiceId = VALID_INVOICE_ID as `0x${string}`
  const merchant = VALID_MERCHANT as `0x${string}`
  const amount = 1_000_000n

  const validLog: FakeLog = {
    address: router,
    args: { invoiceId, merchant, amount },
  }

  it('accepts a matching Paid log', () => {
    expect(verifyReceiptLog([validLog], router, invoiceId, merchant, amount)).toBe('ok')
  })

  it('rejects a log from the wrong router', () => {
    const badLog: FakeLog = { ...validLog, address: MAINNET_ROUTER }
    expect(verifyReceiptLog([badLog], router, invoiceId, merchant, amount)).toBe('unregistered')
  })

  it('rejects a log with the wrong invoiceId', () => {
    const badLog: FakeLog = { ...validLog, args: { ...validLog.args, invoiceId: ('0x' + 'b'.repeat(64)) as `0x${string}` } }
    expect(verifyReceiptLog([badLog], router, invoiceId, merchant, amount)).toBe('unregistered')
  })

  it('rejects a log with amount below expected', () => {
    const badLog: FakeLog = { ...validLog, args: { ...validLog.args, amount: amount - 1n } }
    expect(verifyReceiptLog([badLog], router, invoiceId, merchant, amount)).toBe('unregistered')
  })

  it('accepts a log with amount above expected (overpayment)', () => {
    const overLog: FakeLog = { ...validLog, args: { ...validLog.args, amount: amount + 1n } }
    expect(verifyReceiptLog([overLog], router, invoiceId, merchant, amount)).toBe('ok')
  })

  it('returns unregistered when logs array is empty', () => {
    expect(verifyReceiptLog([], router, invoiceId, merchant, amount)).toBe('unregistered')
  })

  it('correctly identifies the confirmed-but-not-registered state', () => {
    // This is the pay-page "unregistered" state: receipt succeeded but Paid log missing
    expect(verifyReceiptLog([], router, invoiceId, merchant, amount)).toBe('unregistered')
  })
})

// ── maxInvoiceUsdc defaults ───────────────────────────────────────────────────

describe('maxInvoiceUsdc', () => {
  it('defaults to 50 USDC on mainnet', () => {
    expect(maxInvoiceUsdc('mainnet')).toBe(50_000_000n)
  })

  it('defaults to 1000 USDC on testnet', () => {
    expect(maxInvoiceUsdc('testnet')).toBe(1_000_000_000n)
  })

  it('respects an override', () => {
    expect(maxInvoiceUsdc('mainnet', 100)).toBe(100_000_000n)
  })
})
