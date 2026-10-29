/**
 * NetworkBanner — shown on every merchant and pay screen.
 * Matches the landing page announcement bar in weight and spacing.
 */

import { NETWORK } from '@/network'

export default function NetworkBanner() {
  const isMainnet = NETWORK === 'mainnet'
  return (
    <div
      className="sticky top-0 z-50 w-full text-center"
      style={{
        padding: '10px 16px',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        background: isMainnet ? 'var(--warn-dim)' : 'transparent',
        color: isMainnet ? 'var(--warn)' : 'var(--text-muted)',
        borderBottom: '1px solid var(--hairline, #1E1E21)',
      }}
      role="banner"
      aria-label={isMainnet ? 'Arc Mainnet — real USDC' : 'Testnet mode — no real funds'}
    >
      {isMainnet ? 'Arc Mainnet\u202f·\u202freal USDC' : 'Testnet\u202f·\u202fno real funds'}
    </div>
  )
}
