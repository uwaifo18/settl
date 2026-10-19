/** Persistent TESTNET banner shown in both merchant and pay pages. */

export default function TestnetBanner() {
  return (
    <div
      className="sticky top-0 z-50 w-full py-1.5 text-center text-xs font-bold uppercase tracking-widest"
      style={{ background: '#fef3c7', color: '#92400e' }}
      role="banner"
      aria-label="Testnet mode — no real funds"
    >
      TESTNET — no real funds
    </div>
  )
}
