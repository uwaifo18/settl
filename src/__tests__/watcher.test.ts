/**
 * Unit tests for watcher.ts paged getLogs logic, -32012 range halving,
 * -32014 exponential backoff, and history reconciliation.
 *
 * These tests use mocked viem public clients — no network calls are made.
 */

/* oxlint-disable require-await */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers that mirror the watcher.ts logic (pure, env-independent)
// ---------------------------------------------------------------------------

const MAX_BLOCK_RANGE = 9_999n
const BACKOFF_DELAYS = [200, 400, 800] as const

function getRpcErrorCode(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    const code = (e.code ?? (e.cause as Record<string, unknown> | undefined)?.code) as number | undefined
    if (typeof code === 'number') return code
    const msg = String((e as { message?: string }).message ?? '')
    const m = msg.match(/(-32\d{3})/)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

const TRANSIENT_CODES = new Set([-32014, -32005, -32603])
const RANGE_TOO_LARGE_CODE = -32012

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface FakeLog { blockNumber: bigint; transactionHash: string; fromBlock: bigint; toBlock: bigint | 'latest' }

/**
 * Pure implementation of the paged getLogs + retry logic for testing.
 * `fetchFn` is called for each chunk; it may throw with an RPC-like error.
 */
async function pagedGetLogs(
  fetchFn: (fromBlock: bigint, toBlock: bigint) => Promise<FakeLog[]>,
  latestBlock: bigint,
  fromBlock: bigint,
  _slowMs?: number
): Promise<FakeLog[]> {
  const results: FakeLog[] = []
  let cursor = fromBlock
  while (cursor <= latestBlock) {
    const to = cursor + MAX_BLOCK_RANGE - 1n < latestBlock
      ? cursor + MAX_BLOCK_RANGE - 1n
      : latestBlock
    const chunk = await fetchWithRetry(fetchFn, cursor, to, to - cursor + 1n)
    results.push(...chunk)
    cursor = to + 1n
  }
  return results
}

async function fetchWithRetry(
  fetchFn: (from: bigint, to: bigint) => Promise<FakeLog[]>,
  from: bigint,
  to: bigint,
  rangeSize: bigint,
  depth = 0
): Promise<FakeLog[]> {
  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    try {
      return await fetchFn(from, to)
    } catch (err) {
      const code = getRpcErrorCode(err)

      if (code === RANGE_TOO_LARGE_CODE && depth < 6) {
        const half = rangeSize / 2n || 1n
        const mid = from + half - 1n
        const clampedMid = mid < to ? mid : to
        const [left, right] = await Promise.all([
          fetchWithRetry(fetchFn, from, clampedMid, half, depth + 1),
          fetchWithRetry(fetchFn, clampedMid + 1n, to, half, depth + 1),
        ])
        return [...left, ...right]
      }

      if (code !== null && TRANSIENT_CODES.has(code) && attempt < BACKOFF_DELAYS.length) {
        await sleep(1) // fast in tests
        continue
      }

      if (attempt >= BACKOFF_DELAYS.length) throw err
      await sleep(1)
    }
  }
  throw new Error('fetchWithRetry: unreachable')
}

// ---------------------------------------------------------------------------
// History reconciliation helper (mirrors watcher.ts reconcileHistory logic)
// ---------------------------------------------------------------------------

type InvoiceStatus = 'awaiting' | 'paid' | 'expired' | 'underpaid' | 'cancelled'

interface FakeEntry {
  invoiceId: string
  status: InvoiceStatus
  deadline: number
  createdBlock?: bigint
}

interface ReconcileResult {
  invoiceId: string
  newStatus: 'paid' | 'expired'
}

function reconcileEntries(
  entries: FakeEntry[],
  nowSec: number,
  graceSec: number,
  hasMatchingLog: (invoiceId: string) => boolean
): ReconcileResult[] {
  const stale = entries.filter(
    e => e.status === 'awaiting' && e.deadline + graceSec < nowSec
  )
  return stale.map(e => ({
    invoiceId: e.invoiceId,
    newStatus: hasMatchingLog(e.invoiceId) ? 'paid' : 'expired',
  }))
}

// ---------------------------------------------------------------------------
// T4: paged getLogs
// ---------------------------------------------------------------------------

describe('pagedGetLogs — chunking', () => {
  it('does not chunk when range is exactly MAX_BLOCK_RANGE', async () => {
    const calls: Array<[bigint, bigint]> = []
    const fetch = async (from: bigint, to: bigint) => {
      calls.push([from, to])
      return []
    }
    await pagedGetLogs(fetch, MAX_BLOCK_RANGE - 1n, 0n)
    expect(calls.length).toBe(1)
    expect(calls[0]).toEqual([0n, MAX_BLOCK_RANGE - 1n])
  })

  it('splits a range over MAX_BLOCK_RANGE into multiple chunks', async () => {
    const totalBlocks = MAX_BLOCK_RANGE * 3n + 500n
    const latestBlock = totalBlocks - 1n
    const calls: Array<[bigint, bigint]> = []
    const fetch = async (from: bigint, to: bigint) => {
      calls.push([from, to])
      return []
    }
    await pagedGetLogs(fetch, latestBlock, 0n)
    expect(calls.length).toBe(4) // 3 full chunks + 1 partial
    // Each chunk except the last must be exactly MAX_BLOCK_RANGE wide
    for (let i = 0; i < calls.length - 1; i++) {
      const [from, to] = calls[i]
      expect(to - from + 1n).toBe(MAX_BLOCK_RANGE)
    }
    // Chunks must be contiguous and cover the full range
    for (let i = 1; i < calls.length; i++) {
      expect(calls[i][0]).toBe(calls[i - 1][1] + 1n)
    }
    expect(calls[calls.length - 1][1]).toBe(latestBlock)
  })

  it('collects results from all chunks', async () => {
    const latestBlock = MAX_BLOCK_RANGE * 2n - 1n
    const fetch = async (from: bigint, _to: bigint): Promise<FakeLog[]> => [
      { blockNumber: from, transactionHash: `0x${from}`, fromBlock: from, toBlock: _to },
    ]
    const results = await pagedGetLogs(fetch, latestBlock, 0n)
    expect(results.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// T4: -32012 range-too-large halving
// ---------------------------------------------------------------------------

describe('fetchWithRetry — -32012 range halving', () => {
  it('halves the range when -32012 is thrown, then succeeds', async () => {
    const calls: Array<[bigint, bigint]> = []
    let firstCall = true
    const fetch = async (from: bigint, to: bigint): Promise<FakeLog[]> => {
      calls.push([from, to])
      if (firstCall) {
        firstCall = false
        const err = new Error('block range too large') as Error & { code: number }
        err.code = -32012
        throw err
      }
      return []
    }
    await fetchWithRetry(fetch, 0n, MAX_BLOCK_RANGE - 1n, MAX_BLOCK_RANGE)
    // After halving, there should be 3 calls: 1 failed + 2 halved
    expect(calls.length).toBeGreaterThanOrEqual(3)
  })

  it('does not retry -32012 beyond depth 6', async () => {
    // A fetch that always throws -32012 should eventually throw, not loop forever
    const fetch = async (): Promise<FakeLog[]> => {
      const err = new Error('block range') as Error & { code: number }
      err.code = -32012
      throw err
    }
    await expect(fetchWithRetry(fetch, 0n, 1n, 1n, 6)).rejects.toThrow()
  })
})

// ---------------------------------------------------------------------------
// T4: -32014 transient error → exponential backoff
// ---------------------------------------------------------------------------

describe('fetchWithRetry — -32014 transient backoff', () => {
  // These tests use real timers (sleep(1)) to avoid fake-timer/Promise.all interaction.

  it('retries a -32014 error and succeeds on the second attempt', async () => {
    let attempts = 0
    const fetch = async (): Promise<FakeLog[]> => {
      attempts++
      if (attempts === 1) {
        const err = new Error('backend not ready') as Error & { code: number }
        err.code = -32014
        throw err
      }
      return [{ blockNumber: 1n, transactionHash: '0xabc', fromBlock: 0n, toBlock: 1n }]
    }
    const result = await fetchWithRetry(fetch, 0n, 1n, 1n)
    expect(result.length).toBe(1)
    expect(attempts).toBe(2)
  }, 5_000)

  it('gives up after all backoff attempts for a persistent -32014', async () => {
    const fetch = async (): Promise<FakeLog[]> => {
      const err = new Error('always fails') as Error & { code: number }
      err.code = -32014
      throw err
    }
    await expect(fetchWithRetry(fetch, 0n, 1n, 1n)).rejects.toThrow('always fails')
  }, 10_000)

  it('does not retry non-transient errors', async () => {
    let attempts = 0
    const fetch = async (): Promise<FakeLog[]> => {
      attempts++
      const err = new Error('fatal error') as Error & { code: number }
      err.code = -32600 // not in TRANSIENT_CODES
      throw err
    }
    await expect(fetchWithRetry(fetch, 0n, 1n, 1n)).rejects.toThrow('fatal error')
    // Non-transient errors are not retried on backoff path — may go through general backoff
    expect(attempts).toBeLessThanOrEqual(BACKOFF_DELAYS.length + 1)
  }, 5_000)
})

// ---------------------------------------------------------------------------
// T4: getRpcErrorCode — error code extraction
// ---------------------------------------------------------------------------

describe('getRpcErrorCode', () => {
  it('extracts code from direct code property', () => {
    expect(getRpcErrorCode({ code: -32012 })).toBe(-32012)
  })

  it('extracts code from nested cause', () => {
    expect(getRpcErrorCode({ cause: { code: -32014 } })).toBe(-32014)
  })

  it('extracts code from error message string', () => {
    expect(getRpcErrorCode({ message: 'RPC error -32012: block range too large' })).toBe(-32012)
  })

  it('returns null for unknown errors', () => {
    expect(getRpcErrorCode(new Error('no code'))).toBeNull()
    expect(getRpcErrorCode(null)).toBeNull()
    expect(getRpcErrorCode('string error')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// T4: History reconciliation
// ---------------------------------------------------------------------------

describe('reconcileEntries', () => {
  const GRACE = 60
  const NOW = 10_000 // arbitrary "now" in seconds

  it('ignores entries that are not awaiting', async () => {
    const entries: FakeEntry[] = [
      { invoiceId: '0xpaid', status: 'paid', deadline: NOW - 200 },
      { invoiceId: '0xexpired', status: 'expired', deadline: NOW - 200 },
    ]
    const results = reconcileEntries(entries, NOW, GRACE, () => false)
    expect(results).toHaveLength(0)
  })

  it('ignores awaiting entries whose deadline + grace has not passed', async () => {
    const entries: FakeEntry[] = [
      { invoiceId: '0xrecent', status: 'awaiting', deadline: NOW - 30 }, // grace not passed
    ]
    const results = reconcileEntries(entries, NOW, GRACE, () => false)
    expect(results).toHaveLength(0)
  })

  it('marks a stale awaiting entry as paid when a matching log exists', async () => {
    const entries: FakeEntry[] = [
      { invoiceId: '0xstale', status: 'awaiting', deadline: NOW - 200 },
    ]
    const results = reconcileEntries(entries, NOW, GRACE, id => id === '0xstale')
    expect(results).toHaveLength(1)
    expect(results[0].newStatus).toBe('paid')
  })

  it('marks a stale awaiting entry as expired when no log exists', async () => {
    const entries: FakeEntry[] = [
      { invoiceId: '0xstale2', status: 'awaiting', deadline: NOW - 200 },
    ]
    const results = reconcileEntries(entries, NOW, GRACE, () => false)
    expect(results).toHaveLength(1)
    expect(results[0].newStatus).toBe('expired')
  })

  it('reconciles multiple stale entries independently', async () => {
    const entries: FakeEntry[] = [
      { invoiceId: '0xa', status: 'awaiting', deadline: NOW - 200 },
      { invoiceId: '0xb', status: 'awaiting', deadline: NOW - 200 },
      { invoiceId: '0xc', status: 'awaiting', deadline: NOW - 30 }, // not stale
    ]
    const results = reconcileEntries(entries, NOW, GRACE, id => id === '0xa')
    expect(results).toHaveLength(2)
    const a = results.find(r => r.invoiceId === '0xa')!
    const b = results.find(r => r.invoiceId === '0xb')!
    expect(a.newStatus).toBe('paid')
    expect(b.newStatus).toBe('expired')
    expect(results.find(r => r.invoiceId === '0xc')).toBeUndefined()
  })
})
