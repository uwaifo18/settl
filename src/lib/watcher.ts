/**
 * Payment event watcher for SettlRouter / ArcTapRouter.
 * Uses viem with fallback([webSocket(), http(), http(fallback)]) transport.
 * Subscribes via watchContractEvent and backfills via getLogs.
 * Reconnects on visibility change, online event, and WS reconnect.
 *
 * getLogs is paged in chunks of at most MAX_BLOCK_RANGE (9,999) blocks.
 * Arc's public RPC rejects larger ranges with -32012; on that error the range
 * is halved and retried. Transient errors (-32014, network blips) are retried
 * with exponential backoff (200ms → 400ms → 800ms → give up).
 */

import {
  createPublicClient,
  webSocket,
  http,
  fallback,
  parseAbiItem,
} from 'viem'
import { activeChain, RPC_HTTP_URL, RPC_WS_URL, RPC_HTTP_URL_FALLBACK, ROUTER_ADDRESS } from '@/network'
import type { Invoice, HistoryEntry } from './invoice'
import { MEMO_CONTRACT_ADDRESS, decodeMemoData } from './memo'
import { loadHistory, updateHistoryEntry } from './history'

// ArcTapRouter / SettlRouter Paid event ABI item
const PAID_EVENT = parseAbiItem(
  'event Paid(bytes32 indexed invoiceId, address indexed merchant, address indexed payer, uint256 amount)'
)

// Arc Memo contract event ABI item
const MEMO_EVENT = parseAbiItem(
  'event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)'
)

// Arc public RPC rejects getLogs ranges larger than this
const MAX_BLOCK_RANGE = 9_999n

/** Exponential backoff delays in ms — give up after last attempt */
const BACKOFF_DELAYS = [200, 400, 800] as const

/** RPC error codes that are transient and worth retrying */
const TRANSIENT_CODES = new Set([-32014, -32005, -32603])

/** RPC error code for range-too-large — halve the range and retry */
const RANGE_TOO_LARGE_CODE = -32012

function getRpcErrorCode(err: unknown): number | null {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>
    // viem wraps RPC errors; check both top-level and nested cause
    const code = (e.code ?? (e.cause as Record<string, unknown> | undefined)?.code) as number | undefined
    if (typeof code === 'number') return code
    // Also check stringified message for -32012 / -32014
    const msg = typeof (e as { message?: unknown }).message === 'string'
      ? (e as { message: string }).message
      : ''
    const m = msg.match(/(-32\d{3})/)
    if (m) return parseInt(m[1], 10)
  }
  return null
}

export interface PaidLog {
  invoiceId: `0x${string}`
  merchant: `0x${string}`
  payer: `0x${string}`
  amount: bigint
  blockNumber: bigint
  txHash: `0x${string}`
  contractAddress?: `0x${string}`
  blockTimestamp?: number
  removed: boolean
  /** Decoded onchain memo text (business name + note), if a Memo event was emitted */
  onchainMemo?: { businessName?: string; note?: string }
}

export type WatcherCallback = (log: PaidLog) => void

export interface WatcherOptions {
  routerAddress: `0x${string}`
  invoice: Invoice
  onPaid: WatcherCallback
  onError?: (err: Error) => void
}

function makeTransports() {
  const transports = [
    webSocket(RPC_WS_URL, { reconnect: true }),
    http(RPC_HTTP_URL),
  ]
  if (RPC_HTTP_URL_FALLBACK) {
    transports.push(http(RPC_HTTP_URL_FALLBACK))
  }
  return fallback(transports)
}

function makeClient() {
  const chain = {
    ...activeChain,
    rpcUrls: {
      default: { http: [RPC_HTTP_URL], webSocket: [RPC_WS_URL] },
      public: { http: [RPC_HTTP_URL], webSocket: [RPC_WS_URL] },
    },
  }
  return createPublicClient({
    chain,
    transport: makeTransports(),
  })
}

let sharedClient: ReturnType<typeof makeClient> | null = null

function getClient() {
  if (!sharedClient) sharedClient = makeClient()
  return sharedClient
}

/**
 * Verify a received log against the invoice spec.
 * Returns true only if the log legitimately pays THIS invoice.
 */
export function verifyPaidLog(log: PaidLog, invoice: Invoice, routerAddress: `0x${string}`): boolean {
  if (log.removed) return false
  if (log.contractAddress && log.contractAddress.toLowerCase() !== routerAddress.toLowerCase()) return false
  if (log.invoiceId.toLowerCase() !== invoice.invoiceId.toLowerCase()) return false
  if (log.merchant.toLowerCase() !== invoice.merchant.toLowerCase()) return false
  if (log.amount < invoice.amount) return false
  return true
}

/**
 * Sleep helper for backoff.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Typed params for our specific getLogs calls (always bounded bigint blocks). */
interface GetLogsParams {
  address: `0x${string}`
  event: ReturnType<typeof parseAbiItem>
  args?: Record<string, unknown>
  fromBlock: bigint
  toBlock: bigint
}

type RawLog = Awaited<ReturnType<ReturnType<typeof makeClient>['getLogs']>>[number]

/**
 * Fetch getLogs for a single [fromBlock, toBlock] range, retrying transient
 * errors with exponential backoff. If -32012 (range too large) is returned
 * despite the chunk being within MAX_BLOCK_RANGE, halve the range and retry.
 * Returns the raw viem logs array.
 */
async function getLogsWithRetry(
  params: GetLogsParams,
  rangeSize: bigint,
  depth = 0
): Promise<RawLog[]> {
  const client = getClient()
  for (let attempt = 0; attempt <= BACKOFF_DELAYS.length; attempt++) {
    try {
      // viem getLogs accepts bigint fromBlock/toBlock
      return await client.getLogs(params as Parameters<typeof client.getLogs>[0])
    } catch (err) {
      const code = getRpcErrorCode(err)

      // Range too large: halve the range and retry recursively (up to 6 halvings)
      if (code === RANGE_TOO_LARGE_CODE && depth < 6) {
        const half = rangeSize / 2n || 1n
        const from = params.fromBlock
        const mid = from + half - 1n
        const clampedMid = mid < params.toBlock ? mid : params.toBlock
        const [left, right] = await Promise.all([
          getLogsWithRetry({ ...params, fromBlock: from, toBlock: clampedMid }, half, depth + 1),
          getLogsWithRetry({ ...params, fromBlock: clampedMid + 1n, toBlock: params.toBlock }, half, depth + 1),
        ])
        return [...left, ...right]
      }

      // Transient error: backoff and retry
      if (code !== null && TRANSIENT_CODES.has(code) && attempt < BACKOFF_DELAYS.length) {
        await sleep(BACKOFF_DELAYS[attempt])
        continue
      }

      // Final attempt failed or non-retriable error
      if (attempt >= BACKOFF_DELAYS.length) throw err
      // Unknown error on first few attempts: back off and retry
      await sleep(BACKOFF_DELAYS[attempt])
    }
  }
  throw new Error('getLogsWithRetry: unreachable')
}

/**
 * Fetch all Paid logs for an invoice from fromBlock to latest, in pages of
 * at most MAX_BLOCK_RANGE blocks. Returns raw viem log entries.
 */
async function getPagedPaidLogs(
  routerAddress: `0x${string}`,
  invoice: Invoice,
  fromBlock: bigint
): Promise<RawLog[]> {
  const client = getClient()
  const latestBlock = await client.getBlockNumber()
  const results: RawLog[] = []

  let cursor = fromBlock
  while (cursor <= latestBlock) {
    const to = cursor + MAX_BLOCK_RANGE - 1n < latestBlock
      ? cursor + MAX_BLOCK_RANGE - 1n
      : latestBlock

    const chunk = await getLogsWithRetry(
      {
        address: routerAddress,
        event: PAID_EVENT,
        args: { invoiceId: invoice.invoiceId, merchant: invoice.merchant },
        fromBlock: cursor,
        toBlock: to,
      },
      to - cursor + 1n
    )
    results.push(...chunk)
    cursor = to + 1n
  }
  return results
}

/**
 * Backfill getLogs from a given block to 'latest', paged.
 * Returns matching PaidLog entries, enriched with onchain Memo data if available.
 */
export async function backfill(
  routerAddress: `0x${string}`,
  invoice: Invoice,
  fromBlock: bigint
): Promise<PaidLog[]> {
  const client = getClient()
  try {
    const paidLogs = await getPagedPaidLogs(routerAddress, invoice, fromBlock)

    const validPaidLogs = paidLogs.filter(
      (log): log is typeof log & { blockNumber: bigint; transactionHash: `0x${string}` } =>
        log.blockNumber !== null && log.transactionHash !== null
    )

    if (validPaidLogs.length === 0) return []

    // Fetch Memo events (best-effort, single range to latest — memo logs are optional)
    const memoByTxHash = new Map<string, { businessName?: string; note?: string }>()
    try {
      const latestBlock = await client.getBlockNumber()
      // Use paged fetch for Memo too so we don't hit -32012
      let memoCursor = fromBlock
      while (memoCursor <= latestBlock) {
        const to = memoCursor + MAX_BLOCK_RANGE - 1n < latestBlock
          ? memoCursor + MAX_BLOCK_RANGE - 1n
          : latestBlock
        const memoChunk = await getLogsWithRetry(
          {
            address: MEMO_CONTRACT_ADDRESS,
            event: MEMO_EVENT,
            args: { memoId: invoice.invoiceId },
            fromBlock: memoCursor,
            toBlock: to,
          },
          to - memoCursor + 1n
        )
        for (const ml of memoChunk) {
          const mlArgs = (ml as unknown as { args?: { memo?: `0x${string}` } }).args
          if (!ml.transactionHash || !mlArgs?.memo) continue
          const decoded = decodeMemoData(mlArgs.memo)
          if (decoded) {
            memoByTxHash.set(ml.transactionHash.toLowerCase(), {
              businessName: decoded.businessName,
              note: decoded.note,
            })
          }
        }
        memoCursor = to + 1n
      }
    } catch {
      // Memo event fetch is best-effort — don't fail the whole backfill
    }

    return validPaidLogs.map(log => {
      type PaidArgs = { invoiceId: `0x${string}`; merchant: `0x${string}`; payer: `0x${string}`; amount: bigint }
      const args = (log as unknown as { args: PaidArgs }).args
      return {
        invoiceId: args.invoiceId,
        merchant: args.merchant,
        payer: args.payer,
        amount: args.amount,
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        contractAddress: log.address,
        removed: log.removed ?? false,
        onchainMemo: memoByTxHash.get(log.transactionHash.toLowerCase()),
      }
    })
  } catch (err) {
    console.warn('[watcher] backfill error:', err)
    return []
  }
}

export interface Watcher {
  stop: () => void
}

/**
 * Start watching for payment of an invoice.
 * Returns a Watcher with a stop() method.
 */
export function startWatcher(options: WatcherOptions): Watcher {
  const { routerAddress, invoice, onPaid, onError } = options
  let stopped = false
  let unwatch: (() => void) | null = null
  let pollInterval: ReturnType<typeof setInterval> | null = null
  const seenTxHashes = new Set<string>()

  const client = getClient()

  function handleLog(log: PaidLog) {
    if (stopped) return
    if (seenTxHashes.has(log.txHash)) return // idempotent
    if (!verifyPaidLog(log, invoice, routerAddress)) return
    seenTxHashes.add(log.txHash)
    onPaid(log)
  }

  // Keep watching until deadline + 60s grace period
  const gracePeriodMs = (invoice.deadline + 60) * 1000

  async function runBackfill() {
    if (stopped) return
    // Fallback to ~1 hour of Arc blocks (≈3600 at ~1s/block) when createdBlock is missing.
    const fromBlock = invoice.createdBlock ?? (await client.getBlockNumber() - 3_600n)
    const logs = await backfill(routerAddress, invoice, fromBlock)
    logs.forEach(handleLog)
    if (Date.now() > gracePeriodMs) {
      stopped = true
      unwatch?.()
      stopPollFallback()
    }
  }

  function startSubscription() {
    if (stopped) return
    try {
      unwatch?.()
      unwatch = client.watchContractEvent({
        address: routerAddress,
        abi: [PAID_EVENT],
        eventName: 'Paid',
        args: { invoiceId: invoice.invoiceId, merchant: invoice.merchant },
        onLogs: (logs) => {
          for (const log of logs) {
            if (log.blockNumber === null || log.transactionHash === null) continue
            handleLog({
              invoiceId: (log.args as { invoiceId: `0x${string}` }).invoiceId,
              merchant: (log.args as { merchant: `0x${string}` }).merchant,
              payer: (log.args as { payer: `0x${string}` }).payer,
              amount: (log.args as { amount: bigint }).amount,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              contractAddress: log.address,
              removed: log.removed ?? false,
            })
          }
        },
        onError: (err) => { if (!stopped) onError?.(err) },
      })
    } catch (err) {
      if (!stopped) onError?.(err as Error)
    }
  }

  function startPollFallback() {
    if (pollInterval) return
    pollInterval = setInterval(() => {
      if (stopped) return
      void runBackfill()
    }, 2000)
  }

  function stopPollFallback() {
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
  }

  void runBackfill()
  startSubscription()
  startPollFallback()

  function onVisibilityChange() {
    if (!stopped && document.visibilityState === 'visible') {
      void runBackfill(); startSubscription()
    }
  }
  function onOnline() {
    if (!stopped) { void runBackfill(); startSubscription() }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('online', onOnline)

  return {
    stop() {
      stopped = true
      unwatch?.()
      stopPollFallback()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
    },
  }
}

/**
 * One-time check: call isPaid on the router to cross-verify.
 */
export async function checkIsPaid(
  routerAddress: `0x${string}`,
  merchant: `0x${string}`,
  invoiceId: `0x${string}`
): Promise<boolean> {
  const client = getClient()
  try {
    const result = await client.readContract({
      address: routerAddress,
      abi: [{
        type: 'function', name: 'isPaid',
        inputs: [
          { name: 'merchant', type: 'address' },
          { name: 'invoiceId', type: 'bytes32' },
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'view',
      }],
      functionName: 'isPaid',
      args: [merchant, invoiceId],
    })
    return result
  } catch { return false }
}

// ---------------------------------------------------------------------------
// History reconciliation
// ---------------------------------------------------------------------------

/** Grace period added to the invoice deadline before marking as expired (seconds). */
const RECONCILE_GRACE_SECONDS = 60

/**
 * For every `awaiting` history entry whose deadline + grace has passed,
 * run a paged backfill. If a matching Paid log exists → update to `paid`.
 * If none → update to `expired`.
 *
 * Call on app start and when the History screen opens.
 */
export async function reconcileHistory(): Promise<void> {
  let history: HistoryEntry[]
  try {
    history = await loadHistory()
  } catch { return }

  const nowSec = Math.floor(Date.now() / 1000)

  const stale = history.filter(
    e => e.status === 'awaiting' &&
    e.invoice.deadline + RECONCILE_GRACE_SECONDS < nowSec
  )

  if (stale.length === 0) return

  await Promise.allSettled(
    stale.map(async entry => {
      try {
        // Use the router address baked into the invoice, not the current global constant.
        // This matters if the router config changes between creation and reconciliation.
        const invoiceRouter = entry.invoice.routerAddress ?? ROUTER_ADDRESS

        const fromBlock = entry.invoice.createdBlock ??
          // fall back to scanning recent blocks only
          ((await getClient().getBlockNumber()) - 50_000n)

        const logs = await backfill(invoiceRouter, entry.invoice, fromBlock > 0n ? fromBlock : 0n)
        const hit = logs.find(l => verifyPaidLog(l, entry.invoice, invoiceRouter))

        if (hit) {
          await updateHistoryEntry(entry.invoice.invoiceId, {
            status: 'paid',
            txHash: hit.txHash,
            payerAddress: hit.payer,
            onchainMemo: hit.onchainMemo,
          })
        } else {
          await updateHistoryEntry(entry.invoice.invoiceId, { status: 'expired' })
        }
      } catch {
        // best-effort — leave the entry as-is if backfill fails
      }
    })
  )
}
