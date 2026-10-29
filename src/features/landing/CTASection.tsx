import { Section, Container, PrimaryButton } from './primitives'
import { COPY } from './copy'

export default function CTASection() {
  return (
    <Section
      style={{
        paddingTop: 96,
        paddingBottom: 96,
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
      }}
    >
      <Container>
        <h2
          style={{
            fontSize: 'clamp(32px, 4.6vw, 52px)',
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            margin: '0 0 16px',
          }}
        >
          {COPY.cta.h2}
        </h2>
        <p
          style={{
            fontSize: 18,
            color: 'var(--text-muted)',
            margin: '0 0 36px',
            lineHeight: 1.6,
          }}
        >
          {COPY.cta.sub}
        </p>
        <PrimaryButton href="/app" style={{ fontSize: 17, height: 58, padding: '0 36px', borderRadius: 28 }}>
          {COPY.cta.button}
        </PrimaryButton>
      </Container>
    </Section>
  )
}
