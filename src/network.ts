/**
 * src/network.ts — single source of truth for network configuration.
 *
 * Import from here, never hard-code chain IDs, explorer URLs, or router addresses.
 * Every module that needs network facts imports from this file.
 */

import { defineChain, isAddress } from 'viem'
import { arcTestnet } from 'viem/chains'

// ---------------------------------------------------------------------------
// Parse VITE_NETWORK strictly — any non-empty, non-recognised value throws.
// ---------------------------------------------------------------------------
const _raw = import.meta.env.VITE_NETWORK as string | undefined

if (_raw && _raw !== 'mainnet' && _raw !== 'testnet') {
  throw new Error(
    `[network] VITE_NETWORK="${_raw}" is not recognised. ` +
    `Accepted values: "mainnet" | "testnet". Fix your .env before continuing.`
  )
}

export type Network = 'mainnet' | 'testnet'
export const NETWORK: Network = _raw === 'mainnet' ? 'mainnet' : 'testnet'

// ---------------------------------------------------------------------------
// Chain objects
// ---------------------------------------------------------------------------
const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc Mainnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        (import.meta.env.VITE_ARC_MAINNET_RPC_URL as string | undefined) ||
          'https://rpc.mainnet.arc.io',
      ],
      webSocket: [
        (import.meta.env.VITE_ARC_MAINNET_WS_URL as string | undefined) ||
          'wss://rpc.mainnet.arc.io',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
})

export const activeChain = NETWORK === 'mainnet' ? arcMainnet : arcTestnet
export const CHAIN_ID: number = activeChain.id
export const CHAIN_LABEL: string = NETWORK === 'mainnet' ? 'Arc Mainnet' : 'Arc Testnet'

// ---------------------------------------------------------------------------
// RPC endpoints — never derived by string replacement; always separate env vars.
// ---------------------------------------------------------------------------
export const RPC_HTTP_URL: string =
  NETWORK === 'mainnet'
    ? (import.meta.env.VITE_ARC_MAINNET_RPC_URL as string | undefined) ||
      'https://rpc.mainnet.arc.io'
    : (import.meta.env.VITE_ARC_RPC_URL as string | undefined) ||
      'https://rpc.testnet.arc.io'

export const RPC_WS_URL: string =
  NETWORK === 'mainnet'
    ? (import.meta.env.VITE_ARC_MAINNET_WS_URL as string | undefined) ||
      'wss://rpc.mainnet.arc.io'
    : (import.meta.env.VITE_ARC_WS_URL as string | undefined) ||
      'wss://rpc.testnet.arc.io'

/**
 * Optional fallback HTTP RPC (e.g. Blockdaemon, dRPC, QuickNode endpoint from Arc's RPC
 * page). Only add a paid key here if the domain is restricted — never put a secret in a
 * VITE_ variable.
 */
export const RPC_HTTP_URL_FALLBACK: string | undefined =
  NETWORK === 'mainnet'
    ? (import.meta.env.VITE_ARC_MAINNET_RPC_URL_FALLBACK as string | undefined) || undefined
    : undefined

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const

/** ROUTER_ADDRESS is validated at module load time on mainnet. */
const _rawRouter: string =
  NETWORK === 'mainnet'
    ? (import.meta.env.VITE_MAINNET_ROUTER_ADDRESS as string | undefined) ?? ''
    : (import.meta.env.VITE_ROUTER_ADDRESS as string | undefined) ??
      '0x6216af3fb64d039b87088f78da38bd641d62b426'

/** True when the config is broken and payments must be blocked. */
export const CONFIG_ERROR: string | null = (() => {
  if (NETWORK === 'mainnet') {
    if (!_rawRouter || !isAddress(_rawRouter)) {
      return (
        'VITE_MAINNET_ROUTER_ADDRESS is missing or not a valid address. ' +
        'Payments are disabled until this is corrected.'
      )
    }
  }
  return null
})()

export const ROUTER_ADDRESS: `0x${string}` = _rawRouter as `0x${string}`

// ---------------------------------------------------------------------------
// Invoice amount cap
// ---------------------------------------------------------------------------
const _defaultMaxUsdc = NETWORK === 'mainnet' ? 50 : 1000
const _parsedMax = (() => {
  const raw = import.meta.env.VITE_MAX_INVOICE_USDC as string | undefined
  if (!raw) return _defaultMaxUsdc
  const n = parseFloat(raw)
  return isFinite(n) && n > 0 ? n : _defaultMaxUsdc
})()
/** Maximum invoice amount in micro-USDC (6 decimals). */
export const MAX_INVOICE_USDC: bigint = BigInt(Math.round(_parsedMax * 1_000_000))

// ---------------------------------------------------------------------------
// Explorer helpers
// ---------------------------------------------------------------------------
const _explorerBase =
  NETWORK === 'mainnet' ? 'https://explorer.arc.io' : 'https://explorer.testnet.arc.io'

export function explorerTx(hash: string): string {
  return `${_explorerBase}/tx/${hash}`
}

export function explorerAddress(addr: string): string {
  return `${_explorerBase}/address/${addr}`
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------
/** True only on testnet — controls whether a faucet link is shown. */
export const HAS_FAUCET: boolean = NETWORK === 'testnet'
