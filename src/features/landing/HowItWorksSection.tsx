import { Section, Container, Label, TwoTone } from './primitives'
import { COPY } from './copy'

export default function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      style={{ paddingTop: 80, paddingBottom: 80, borderTop: '1px solid var(--border)' }}
    >
      <Container>
        <Label>{COPY.howItWorks.label}</Label>
        <TwoTone
          first={COPY.howItWorks.h2First}
          muted={COPY.howItWorks.h2Muted}
          id="how-it-works-heading"
          style={{
            fontSize: 'clamp(32px, 4.6vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            margin: '12px 0 40px',
          }}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 20,
          }}
        >
          {COPY.howItWorks.steps.map(step => (
            <div
              key={step.n}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 24,
                padding: 24,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  border: '1.5px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--paid)', fontVariantNumeric: 'tabular-nums' }}>
                  {step.n}
                </span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
                {step.title}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
