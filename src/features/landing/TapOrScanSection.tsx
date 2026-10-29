import { Section, Container, Label, TwoTone, Card } from './primitives'
import { COPY } from './copy'

/** Concentric ring SVG — decorative NFC illustration. */
function NFCRings() {
  return (
    <svg
      width="200"
      height="200"
      viewBox="0 0 200 200"
      aria-hidden="true"
      style={{ display: 'block', margin: '0 auto' }}
    >
      <circle cx="100" cy="100" r="92" stroke="#2A2A2E" strokeWidth="1.5" fill="none" />
      <circle cx="100" cy="100" r="68" stroke="#1E1E21" strokeWidth="1.5" fill="none" />
      <circle cx="100" cy="100" r="44" stroke="#262628" strokeWidth="1.5" fill="none" />
      <circle cx="100" cy="100" r="10" fill="#35D49A" />
    </svg>
  )
}

export default function TapOrScanSection() {
  return (
    <Section
      id="tap-or-scan"
      style={{ paddingTop: 80, paddingBottom: 80, borderTop: '1px solid var(--border)' }}
    >
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 56,
            alignItems: 'center',
          }}
        >
          {/* Text column */}
          <div>
            <Label>{COPY.tapOrScan.label}</Label>
            <TwoTone
              first={COPY.tapOrScan.h2First}
              muted={COPY.tapOrScan.h2Muted}
              id="tap-or-scan-heading"
              style={{
                fontSize: 'clamp(32px, 4.6vw, 48px)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                margin: '12px 0 20px',
              }}
            />
            <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.7, margin: '0 0 16px', maxWidth: '48ch' }}>
              {COPY.tapOrScan.body}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-subtle, #5A5652)', margin: 0, lineHeight: 1.6 }}>
              {COPY.tapOrScan.caveat}
            </p>
          </div>

          {/* Card column */}
          <Card radius={28} padding={28}>
            {/* Pill switch */}
            <div
              style={{
                display: 'inline-flex',
                background: 'var(--surface-raised, #1A1A1D)',
                borderRadius: 24,
                padding: 3,
                marginBottom: 24,
                border: '1px solid var(--border)',
              }}
            >
              <span
                style={{
                  padding: '6px 18px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 700,
                  background: 'var(--text)',
                  color: 'var(--bg)',
                }}
              >
                NFC
              </span>
              <span
                style={{
                  padding: '6px 18px',
                  borderRadius: 20,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                }}
              >
                QR
              </span>
            </div>

            <NFCRings />

            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                textAlign: 'center',
                margin: '20px 0 0',
                lineHeight: 1.5,
              }}
            >
              {COPY.tapOrScan.cardCaption}
            </p>
          </Card>
        </div>
      </Container>
    </Section>
  )
}
