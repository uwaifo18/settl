/**
 * Amount parsing and formatting for USDC (6 decimals).
 * Keypad string -> bigint micro-USDC, and display formatting.
 */

export const USDC_DECIMALS = 6
const USDC_SCALE = 10n ** BigInt(USDC_DECIMALS) // 1_000_000n

/**
 * Parse a user-entered string like "12.50" into micro-USDC bigint.
 * Returns null if the string is invalid.
 * Rules:
 * - Must be a valid decimal number
 * - Max 2 decimal places
 * - Must be > 0
 * - Must not be negative
 */
export function parseUsdcInput(input: string): bigint | null {
  if (!input || input.trim() === '') return null

  // Allow only digits and a single dot
  if (!/^\d*\.?\d*$/.test(input)) return null

  const parts = input.split('.')
  if (parts.length > 2) return null

  const intPart = parts[0] || '0'
  const fracPart = parts[1] ?? ''

  // Reject more than 2 decimal places
  if (fracPart.length > 2) return null

  // Pad fractional part to 6 decimals (USDC)
  const fracPadded = fracPart.padEnd(USDC_DECIMALS, '0')

  try {
    const raw = BigInt(intPart) * USDC_SCALE + BigInt(fracPadded)
    if (raw <= 0n) return null
    return raw
  } catch {
    return null
  }
}

/**
 * Format micro-USDC bigint as a display string with 2 decimal places.
 * e.g. 12_500_000n -> "12.50"
 */
export function formatUsdc(microUsdc: bigint): string {
  const intPart = microUsdc / USDC_SCALE
  const fracPart = microUsdc % USDC_SCALE
  const fracStr = fracPart.toString().padStart(USDC_DECIMALS, '0')
  // Show 2 decimal places
  return `${intPart}.${fracStr.slice(0, 2)}`
}

/**
 * Format micro-USDC as currency display: "$12.50 USDC"
 */
export function formatUsdcDisplay(microUsdc: bigint): string {
  return `$${formatUsdc(microUsdc)} USDC`
}

/**
 * Validate a keypad input string is valid for USDC entry.
 * Returns: 'ok' | error message string
 */
export function validateUsdcInput(input: string): string {
  if (!input || input === '' || input === '.') return 'Enter an amount'
  if (!/^\d*\.?\d*$/.test(input)) return 'Invalid amount'
  const parts = input.split('.')
  if (parts.length > 2) return 'Invalid amount'
  if ((parts[1] ?? '').length > 2) return 'Max 2 decimal places'
  const parsed = parseUsdcInput(input)
  if (parsed === null || parsed <= 0n) return 'Amount must be greater than 0'
  return 'ok'
}

/**
 * Apply a keypad digit press to the current amount string.
 * Handles '0'–'9' and '.'.
 */
export function applyKeypadPress(current: string, key: string): string {
  if (key === '.' ) {
    if (current.includes('.')) return current
    return current === '' ? '0.' : current + '.'
  }
  if (key === 'backspace') {
    return current.slice(0, -1)
  }
  if (!/^\d$/.test(key)) return current

  // Prevent more than 2 decimal places
  const parts = current.split('.')
  if (parts.length === 2 && parts[1].length >= 2) return current

  // Prevent leading zeros (except "0.")
  if (current === '0' && key !== '.') return key

  return current + key
}

/** Format an address for display: 0x1234...5678 */
export function formatAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address || address.length < startChars + endChars + 2) return address
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`
}

/** Amount exceeds 100 USDC warning threshold */
export const LARGE_AMOUNT_THRESHOLD = 100n * USDC_SCALE

export function isLargeAmount(microUsdc: bigint): boolean {
  return microUsdc > LARGE_AMOUNT_THRESHOLD
}
