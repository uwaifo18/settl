/**
 * Circle Modular Wallet via passkey.
 * Used on the merchant setup screen to create/restore a Circle smart account
 * and return its address as the merchant receiving address.
 *
 * The account address is deterministic per passkey — same credential always
 * produces the same address. We only need the address here; the merchant
 * receives USDC via the standard ERC-20 path, no user-ops required.
 */

import { createPublicClient } from 'viem'
import { arcTestnet } from 'viem/chains'
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

const STORAGE_KEY = 'settl:passkey-credential:v1'
const CLIENT_KEY = import.meta.env.VITE_CLIENT_KEY as string | undefined
const CLIENT_URL = import.meta.env.VITE_CLIENT_URL as string | undefined

function getTransports() {
  if (!CLIENT_KEY || !CLIENT_URL) throw new Error('Circle Client Key not configured.')
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, CLIENT_KEY)
  const modularTransport = toModularTransport(`${CLIENT_URL}/arcTestnet`, CLIENT_KEY)
  return { passkeyTransport, modularTransport }
}

async function resolveAddress(credential: P256Credential): Promise<`0x${string}`> {
  const { modularTransport } = getTransports()
  const client = createPublicClient({ chain: arcTestnet, transport: modularTransport })
  const account = await toCircleSmartAccount({
    client,
    owner: toWebAuthnAccount({ credential }),
  })
  return account.address
}

/** Register a new passkey and return the smart account address. */
export async function registerPasskeyWallet(username: string): Promise<`0x${string}`> {
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
  const { passkeyTransport } = getTransports()
  const credential = await toWebAuthnCredential({
    transport: passkeyTransport,
    mode: WebAuthnMode.Login,
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(credential))
  return resolveAddress(credential)
}

/** Restore from localStorage (returns null if nothing stored). */
export async function restorePasskeyWallet(): Promise<`0x${string}` | null> {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const credential = JSON.parse(raw) as P256Credential
    return await resolveAddress(credential)
  } catch {
    return null
  }
}

/** True if a Circle client key is configured. */
export function isCircleConfigured(): boolean {
  return !!CLIENT_KEY && CLIENT_KEY.startsWith('TEST_CLIENT_KEY:')
}
