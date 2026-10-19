/**
 * Merchant settings persisted to localStorage.
 * No private keys, no sensitive data — just address + display prefs.
 */

import { isAddress } from 'viem'

const STORAGE_KEY = 'settl:merchant:v1'

export interface MerchantSettings {
  address: `0x${string}`
  name: string            // business name, max 32 chars
  soundEnabled: boolean
  hapticsEnabled: boolean
}

export function loadMerchantSettings(): MerchantSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as MerchantSettings
    if (!isAddress(parsed.address)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveMerchantSettings(settings: MerchantSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearMerchantSettings(): void {
  localStorage.removeItem(STORAGE_KEY)
}
