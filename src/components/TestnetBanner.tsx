/** Persistent TESTNET banner — slim, uses design tokens. */

import { IS_MAINNET } from '@/config'
export default function TestnetBanner() {
  if (IS_MAINNET) return null
  return (
    <div
      className="sticky top-0 z-50 w-full py-1.5 text-center text-xs font-semibold uppercase tracking-widest"
      style={{ background: 'var(--warn-dim)', color: 'var(--warn)', borderBottom: '1px solid var(--border)' }}
      role="banner"
      aria-label="Testnet mode — no real funds"
    >
      Testnet — no real funds
    </div>
  )
}
