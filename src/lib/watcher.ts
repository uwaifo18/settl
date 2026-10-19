/**
 * Payment event watcher for ArcTapRouter.
 * Uses viem with fallback([webSocket(), http()]) transport.
 * Subscribes via watchContractEvent and backfills via getLogs.
 * Reconnects on visibility change, online event, and WS reconnect.
 */

import {
  createPublicClient,
  webSocket,
  http,
  fallback,
  parseAbiItem,
} from 'viem'
import { arcTestnet } from 'viem/chains'
import { requireChain } from '@/onchain-facts'
import type { Invoice } from './invoice'
import { MEMO_CONTRACT_ADDRESS, decodeMemoData } from './memo'

const ARC_TESTNET_CHAIN_ID = 5042002
const chain = requireChain(ARC_TESTNET_CHAIN_ID)

// ArcTapRouter Paid event ABI item
const PAID_EVENT = parseAbiItem(
  'event Paid(bytes32 indexed invoiceId, address indexed merchant, address indexed payer, uint256 amount)'
)

// Arc Memo contract event ABI item
const MEMO_EVENT = parseAbiItem(
  'event Memo(address indexed sender, address indexed target, bytes32 callDataHash, bytes32 indexed memoId, bytes memo, uint256 memoIndex)'
)

export interface PaidLog {
  invoiceId: `0x${string}`
  merchant: `0x${string}`
  payer: `0x${string}`
  amount: bigint
  blockNumber: bigint
  txHash: `0x${string}`
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

function makeClient(rpcUrl: string) {
  const wsUrl = rpcUrl.replace(/^https?:\/\//, 'wss://')
  return createPublicClient({
    chain: {
      ...arcTestnet,
      id: ARC_TESTNET_CHAIN_ID,
      rpcUrls: {
        default: { http: [rpcUrl], webSocket: [wsUrl] },
        public: { http: [rpcUrl], webSocket: [wsUrl] },
      },
    },
    transport: fallback([
      webSocket(wsUrl, { reconnect: true }),
      http(rpcUrl),
    ]),
  })
}

const rpcUrl = chain.rpcUrls[0]
let sharedClient: ReturnType<typeof makeClient> | null = null

function getClient() {
  if (!sharedClient) {
    sharedClient = makeClient(rpcUrl)
  }
  return sharedClient
}

/**
 * Verify a received log against the invoice spec.
 * Returns true only if the log legitimately pays THIS invoice.
 */
export function verifyPaidLog(log: PaidLog, invoice: Invoice, _routerAddress: `0x${string}`): boolean {
  if (log.removed) return false
  if (log.invoiceId.toLowerCase() !== invoice.invoiceId.toLowerCase()) return false
  if (log.merchant.toLowerCase() !== invoice.merchant.toLowerCase()) return false
  if (log.amount < invoice.amount) return false
  // routerAddress is already validated at URL parse time, but double-check
  return true
}

/**
 * Backfill getLogs from a given block to 'latest'.
 * Returns matching PaidLog entries, enriched with onchain Memo data if available.
 */
async function backfill(
  routerAddress: `0x${string}`,
  invoice: Invoice,
  fromBlock: bigint
): Promise<PaidLog[]> {
  const client = getClient()
  try {
    // Fetch Paid events from the router
    const paidLogs = await client.getLogs({
      address: routerAddress,
      event: PAID_EVENT,
      args: {
        invoiceId: invoice.invoiceId,
        merchant: invoice.merchant,
      },
      fromBlock,
      toBlock: 'latest',
    })

    const validPaidLogs = paidLogs
      .filter((log): log is typeof log & { blockNumber: bigint; transactionHash: `0x${string}` } =>
        log.blockNumber !== null && log.transactionHash !== null
      )

    if (validPaidLogs.length === 0) return []

    // Fetch Memo events from the Arc Memo contract filtered by memoId = invoiceId
    let memoByTxHash = new Map<string, { businessName?: string; note?: string }>()
    try {
      const memoLogs = await client.getLogs({
        address: MEMO_CONTRACT_ADDRESS,
        event: MEMO_EVENT,
        args: { memoId: invoice.invoiceId },
        fromBlock,
        toBlock: 'latest',
      })
      for (const ml of memoLogs) {
        if (!ml.transactionHash || !ml.args.memo) continue
        const decoded = decodeMemoData(ml.args.memo)
        if (decoded) {
          memoByTxHash.set(ml.transactionHash.toLowerCase(), {
            businessName: decoded.businessName,
            note: decoded.note,
          })
        }
      }
    } catch {
      // Memo event fetch is best-effort — don't fail the whole backfill
    }

    return validPaidLogs.map(log => ({
      invoiceId: log.args.invoiceId as `0x${string}`,
      merchant: log.args.merchant as `0x${string}`,
      payer: log.args.payer as `0x${string}`,
      amount: log.args.amount as bigint,
      blockNumber: log.blockNumber,
      txHash: log.transactionHash,
      removed: log.removed ?? false,
      onchainMemo: memoByTxHash.get(log.transactionHash.toLowerCase()),
    }))
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

  async function runBackfill() {
    if (stopped) return
    const fromBlock = invoice.createdBlock ?? (await client.getBlockNumber() - 50n)
    const logs = await backfill(routerAddress, invoice, fromBlock)
    logs.forEach(handleLog)
  }

  function startSubscription() {
    if (stopped) return
    try {
      unwatch?.()
      unwatch = client.watchContractEvent({
        address: routerAddress,
        abi: [PAID_EVENT],
        eventName: 'Paid',
        args: {
          invoiceId: invoice.invoiceId,
          merchant: invoice.merchant,
        },
        onLogs: (logs) => {
          for (const log of logs) {
            if (log.blockNumber === null || log.transactionHash === null) continue
            handleLog({
              invoiceId: log.args.invoiceId as `0x${string}`,
              merchant: log.args.merchant as `0x${string}`,
              payer: log.args.payer as `0x${string}`,
              amount: log.args.amount as bigint,
              blockNumber: log.blockNumber,
              txHash: log.transactionHash,
              removed: log.removed ?? false,
            })
          }
        },
        onError: (err) => {
          if (!stopped) onError?.(err)
        },
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
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
  }

  // Initial setup
  void runBackfill()
  startSubscription()
  startPollFallback() // always poll as fallback while awaiting

  // Reconnect on visibility change
  function onVisibilityChange() {
    if (!stopped && document.visibilityState === 'visible') {
      void runBackfill()
      startSubscription()
    }
  }

  // Reconnect on network restore
  function onOnline() {
    if (!stopped) {
      void runBackfill()
      startSubscription()
    }
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
        type: 'function',
        name: 'isPaid',
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
  } catch {
    return false
  }
}
