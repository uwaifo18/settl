import { Section, Container } from './primitives'
import { COPY } from './copy'

export default function WhyArcSection() {
  return (
    <Section
      id="features"
      style={{ borderTop: '1px solid var(--border)', paddingTop: 64, paddingBottom: 64 }}
    >
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 32,
          }}
        >
          {COPY.whyArc.map(item => (
            <div key={item.title}>
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '0 0 8px' }}>
                {item.title}
              </p>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}
