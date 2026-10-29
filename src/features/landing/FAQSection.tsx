import { Section, Container, Label, TwoTone } from './primitives'
import { COPY } from './copy'

export default function FAQSection() {
  return (
    <Section
      id="faq"
      style={{ paddingTop: 80, paddingBottom: 80, borderTop: '1px solid var(--border)' }}
    >
      <Container>
        <Label>{COPY.faq[0] ? 'FAQ' : ''}</Label>
        <TwoTone
          first="Questions,"
          muted="answered plainly."
          id="faq-heading"
          style={{
            fontSize: 'clamp(32px, 4.6vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            margin: '12px 0 40px',
          }}
        />

        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {COPY.faq.map((item, i) => (
            <details
              key={item.q}
              open={i === 0}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <summary
                style={{
                  padding: '18px 22px',
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  listStyle: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none',
                  minHeight: 56,
                }}
              >
                {item.q}
                <svg
                  className="faq-chevron"
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                  style={{ flexShrink: 0, transition: 'transform 0.2s' }}
                >
                  <path d="M5 7l4 4 4-4" stroke="var(--text-muted)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <p
                style={{
                  margin: 0,
                  padding: '0 22px 20px',
                  fontSize: 15,
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                }}
              >
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </Container>

      <style>{`
        details[open] .faq-chevron { transform: rotate(180deg); }
        details summary::-webkit-details-marker { display: none; }
      `}</style>
    </Section>
  )
}
