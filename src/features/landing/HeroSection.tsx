import { Section, Container, TwoTone, PrimaryButton } from './primitives'
import { COPY } from './copy'

/** Animated pulsing dot — respects prefers-reduced-motion. */
function PulseDot() {
  return (
    <>
      <span
        className="hero-pulse-dot"
        style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--paid)',
          marginRight: 6,
          flexShrink: 0,
        }}
      />
      <style>{`
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(53,212,154,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(53,212,154,0); }
          100% { box-shadow: 0 0 0 0 rgba(53,212,154,0); }
        }
        .hero-pulse-dot { animation: pulse-ring 1.6s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hero-pulse-dot { animation: none !important; }
        }
      `}</style>
    </>
  )
}

/** Decorative hero product card — charge side (left). */
function ChargeCard() {
  return (
    <div
      style={{
        flex: '1 1 0',
        background: 'var(--surface)',
        borderRadius: '28px 0 0 28px',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 12,
        minHeight: 220,
      }}
    >
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
        Charge
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, color: 'var(--text)', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
          12.50
        </span>
        <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--paid)' }}>USDC</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
        <PulseDot />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Waiting for payment</span>
      </div>
    </div>
  )
}

/** Decorative hero product card — paid side (right). */
function PaidCard() {
  return (
    <div
      style={{
        flex: '1 1 0',
        background: 'var(--paid)',
        borderRadius: '0 28px 28px 0',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
        minHeight: 220,
      }}
    >
      {/* Ring + check icon */}
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="18" stroke="#0B0B0C" strokeWidth="2.5" />
        <path d="M12 20.5l5.5 5.5 10.5-11" stroke="#0B0B0C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <p style={{ fontSize: 28, fontWeight: 800, color: '#0B0B0C', letterSpacing: '-0.03em', margin: 0 }}>PAID</p>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#0B0B0C', margin: 0, fontVariantNumeric: 'tabular-nums' }}>12.50 USDC</p>
      <p style={{ fontSize: 12, color: 'rgba(11,11,12,0.6)', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>from 0x12ab…89cd</p>
      <p style={{ fontSize: 11, color: 'rgba(11,11,12,0.45)', margin: '4px 0 0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Example payment</p>
    </div>
  )
}

export default function HeroSection() {
  return (
    <Section style={{ paddingTop: 80, paddingBottom: 80 }}>
      <Container>
        <div style={{ maxWidth: 720 }}>
          <TwoTone
            first={COPY.hero.h1First}
            muted={COPY.hero.h1Muted}
            as="h1"
            style={{
              fontSize: 'clamp(44px, 8vw, 84px)',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.04em',
              marginBottom: 24,
              textWrap: 'balance',
            }}
          />
          <p
            style={{
              fontSize: 'clamp(17px, 2.5vw, 21px)',
              color: 'var(--text-muted)',
              maxWidth: 620,
              lineHeight: 1.6,
              marginBottom: 36,
              textWrap: 'pretty',
            }}
          >
            {COPY.hero.sub}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <PrimaryButton href="/app">{COPY.hero.ctaPrimary}</PrimaryButton>
          </div>
        </div>

        {/* Product card */}
        <div
          aria-label="Example payment flow"
          style={{
            display: 'flex',
            marginTop: 56,
            borderRadius: 32,
            border: '1px solid var(--border)',
            overflow: 'hidden',
            minHeight: 280,
            maxWidth: 560,
          }}
        >
          <ChargeCard />
          <PaidCard />
        </div>
      </Container>
    </Section>
  )
}
