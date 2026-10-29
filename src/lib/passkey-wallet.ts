/**
 * Circle Modular Wallet via passkey.
 * Used on the merchant setup screen to create/restore a Circle smart account
 * and return its address as the merchant receiving address.
 *
 * MAINNET SAFETY:
 * Passkey wallet support on mainnet is DISABLED by default.
 * Set VITE_PASSKEY_MAINNET_ENABLED=true to enable it — but only after the owner
 * verifies that Circle's modular wallet endpoint is available on Arc Mainnet
 * and that address derivation is deterministic across networks (see DECISIONS.md D9).
 * A smart-account address derived on testnet may not be controllable on mainnet,
 * and USDC sent there could be lost.
 */

import { createPublicClient } from 'viem'
import {
  type P256Credential,
  toWebAuthnAccount,
} from 'viem/account-abstraction'
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
} from '@circle-fin/modular-wallets-core'
import { NETWORK, activeChain } from '@/network'

const STORAGE_KEY = 'settl:passkey-credential:v1'
const CLIENT_KEY = import.meta.env.VITE_CLIENT_KEY as string | undefined
const CLIENT_URL = import.meta.env.VITE_CLIENT_URL as string | undefined

/** True if passkey wallets are available in this build. */
export function isPasskeyAvailable(): boolean {
  if (NETWORK === 'mainnet') {
    // Only allow if explicitly opted in by the owner
    return import.meta.env.VITE_PASSKEY_MAINNET_ENABLED === 'true' &&
      !!CLIENT_KEY && !!CLIENT_URL
  }
  return !!CLIENT_KEY && CLIENT_KEY.startsWith('TEST_CLIENT_KEY:')
}

function getChainPath(): string {
  // Build the chain path from activeChain, never hard-coded
  if (NETWORK === 'mainnet') return 'arc'
  return 'arcTestnet'
}

function getTransports() {
  if (!CLIENT_KEY || !CLIENT_URL) throw new Error('Circle Client Key not configured.')
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, CLIENT_KEY)
  const modularTransport = toModularTransport(`${CLIENT_URL}/${getChainPath()}`, CLIENT_KEY)
  return { passkeyTransport, modularTransport }
}

async function resolveAddress(credential: P256Credential): Promise<`0x${string}`> {
  const { modularTransport } = getTransports()
  const client = createPublicClient({ chain: activeChain, transport: modularTransport })
  const account = await toCircleSmartAccount({
    client,
    owner: toWebAuthnAccount({ credential }),
  })
  return account.address
}

/** Register a new passkey and return the smart account address. */
export async function registerPasskeyWallet(username: string): Promise<`0x${string}`> {
  if (!isPasskeyAvailable()) {
    throw new Error('Passkey wallets are not available on this network. Paste a receiving address instead.')
  }
  const { passkeyTransport } = getTransports()
  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: WebAuthnMode.Register,
    username: username || 'settl-merchant',
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential))
  return resolveAddress(credential)
}

/** Log in with an existing passkey and return the smart account address. */
export async function loginPasskeyWallet(): Promise<`0x${string}`> {
  if (!isPasskeyAvailable()) {
    throw new Error('Passkey wallets are not available on this network. Paste a receiving address instead.')
  }
  const { passkeyTransport } = getTransports()
  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: WebAuthnMode.Login,
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential))
  return resolveAddress(credential)
}

/** Restore from localStorage (returns null if nothing stored or not available). */
export async function restorePasskeyWallet(): Promise<`0x${string}` | null> {
  if (!isPasskeyAvailable()) return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const credential = JSON.parse(raw) as P256Credential
    return await resolveAddress(credential)
  } catch {
    return null
  }
}

/** True if a Circle client key is configured (legacy check, prefer isPasskeyAvailable). */
export function isCircleConfigured(): boolean {
  return isPasskeyAvailable()
}
