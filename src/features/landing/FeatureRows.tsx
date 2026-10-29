import { Section, Container, Label, TwoTone, Card } from './primitives'
import { COPY } from './copy'

/** Decorative QR-style grid (SVG, aria-hidden). */
function QRDecorativeSVG() {
  // 7×7 finder pattern blocks top-left, top-right, bottom-left + random data cells
  const finder = [
    [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
    [6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],
    [1,0],[2,0],[3,0],[4,0],[5,0],
    [1,6],[2,6],[3,6],[4,6],[5,6],
    [2,2],[2,3],[2,4],[3,2],[3,3],[3,4],[4,2],[4,3],[4,4],
  ]
  const data = [
    [0,8],[0,9],[1,9],[2,8],[3,9],[4,8],[4,9],[5,8],[6,8],
    [0,11],[1,11],[2,10],[3,10],[4,11],[5,10],[5,11],[6,10],[6,11],[6,12],
    [8,0],[8,1],[9,0],[10,1],[11,0],[11,1],[12,0],
    [8,3],[8,4],[9,3],[10,3],[10,4],[11,4],[12,3],[12,4],
    [8,6],[9,6],[9,7],[10,6],[11,7],[12,6],[12,7],
    [8,8],[9,9],[10,8],[10,9],[11,8],[12,9],
    [8,10],[8,11],[9,11],[10,10],[11,11],[12,10],[12,11],
  ]
  const S = 8 // cell size
  const cells = [...finder, ...data]
  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      aria-hidden="true"
      style={{ borderRadius: 8 }}
    >
      <rect width="104" height="104" fill="#fff" rx="6" />
      {cells.map(([r, c]) => (
        <rect
          key={`${r}-${c}`}
          x={c * S + 4}
          y={r * S + 4}
          width={S - 1}
          height={S - 1}
          fill="#0B0B0C"
          rx="1"
        />
      ))}
    </svg>
  )
}

/** Feature row 01 — Charge card */
function ChargeFeatureCard() {
  return (
    <Card radius={28} padding={28}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Invoice</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--paid)' }}>Awaiting payment</span>
      </div>
      {/* QR */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, padding: 8 }}>
          <QRDecorativeSVG />
        </div>
      </div>
      {/* Amount */}
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>12.50 </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--paid)' }}>USDC</span>
      </div>
      <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', margin: '8px 0 0' }}>
        Expires in 09:42
      </p>
    </Card>
  )
}

/** Feature row 02 — Pay card */
function PayFeatureCard() {
  const rows = [
    { label: 'Merchant',     value: "Ada's Kitchen" },
    { label: 'Address',      value: '0x4F2a\u2026e9B0', mono: true },
    { label: 'Amount',       value: '12.50 USDC', tabular: true },
    { label: 'Network fee',  value: 'Shown before you sign', muted: true },
  ]
  return (
    <Card radius={28} padding={28}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{r.label}</span>
            <span style={{
              fontSize: 13,
              fontWeight: r.muted ? 400 : 600,
              color: r.muted ? 'var(--text-muted)' : 'var(--text)',
              fontFamily: r.mono ? 'JetBrains Mono, monospace' : undefined,
              fontVariantNumeric: r.tabular ? 'tabular-nums' : undefined,
            }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <button
        type="button"
        style={{
          width: '100%',
          height: 52,
          background: 'var(--text)',
          color: 'var(--bg)',
          border: 'none',
          borderRadius: 16,
          fontSize: 15,
          fontWeight: 700,
          cursor: 'default',
        }}
      >
        Approve 12.50 USDC
      </button>
    </Card>
  )
}

/** Feature row 03 — Settled card */
function SettledFeatureCard() {
  const checks = [
    'Paid through the Settl router',
    'Merchant address matches',
    'Invoice ID matches',
    'Amount covers the invoice',
  ]
  return (
    <Card radius={28} padding={28}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        {checks.map(c => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <circle cx="9" cy="9" r="8.5" stroke="var(--paid)" />
              <path d="M5.5 9.5l2.5 2.5 4.5-5" stroke="var(--paid)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{c}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          background: 'var(--paid)',
          borderRadius: 16,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 18, fontWeight: 800, color: '#0B0B0C', letterSpacing: '-0.02em' }}>PAID</span>
      </div>
    </Card>
  )
}

/** Feature row 04 — Convert card (coming soon) */
function ConvertFeatureCard() {
  const steps = [
    { from: '12.50 USDC', to: null,        label: 'Received' },
    { from: null,          to: '11.62 USD', label: 'Converted' },
    { from: null,          to: 'Bank ····4821', label: 'Withdrawn' },
  ]
  return (
    <Card radius={28} padding={28}>
      {/* Coming soon chip */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          background: 'var(--surface-raised, #1A1A1D)',
          border: '1px solid var(--border)',
          borderRadius: 99,
          padding: '3px 10px',
        }}>
          Coming soon
        </span>
      </div>

      {/* Flow rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 24 }}>
        {steps.map((s, i) => (
          <div key={s.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.label}</span>
              <span style={{
                fontSize: 14,
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: s.from ? 'var(--text-muted)' : 'var(--paid)',
              }}>
                {s.from ?? s.to}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 2px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3v10M4 9l4 4 4-4" stroke="var(--border)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Disabled CTA */}
      <div
        style={{
          width: '100%',
          height: 52,
          background: 'var(--surface-raised, #1A1A1D)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="2" stroke="var(--text-muted)" strokeWidth="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>
          Convert &amp; withdraw
        </span>
      </div>
    </Card>
  )
}

const CARDS = [ChargeFeatureCard, PayFeatureCard, SettledFeatureCard, ConvertFeatureCard]

export default function FeatureRows() {
  return (
    <Section
      id="feature-details"
      style={{ paddingTop: 80, paddingBottom: 80, borderTop: '1px solid var(--border)' }}
      aria-label="Feature details"
    >
      <Container>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 80 }}>
          {COPY.features.map((f, i) => {
            const CardComponent = CARDS[i]
            return (
              <div
                key={f.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 48,
                  alignItems: 'center',
                }}
              >
                {/* Text */}
                <div>
                  <Label>{f.label}</Label>
                  <TwoTone
                    first={f.h2First}
                    muted={f.h2Muted}
                    style={{
                      fontSize: 'clamp(28px, 4vw, 40px)',
                      fontWeight: 800,
                      lineHeight: 1.15,
                      letterSpacing: '-0.03em',
                      margin: '12px 0 16px',
                    }}
                  />
                  <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, maxWidth: '44ch' }}>
                    {f.body}
                  </p>
                </div>
                {/* Card */}
                <CardComponent />
              </div>
            )
          })}
        </div>
      </Container>
    </Section>
  )
}
