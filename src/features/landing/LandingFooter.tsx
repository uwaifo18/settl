import { Container } from './primitives'
import { COPY } from './copy'

export default function LandingFooter() {
  return (
    <footer style={{ borderTop: '1px solid var(--hairline, #1E1E21)' }}>
      <Container>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            paddingTop: 28,
            paddingBottom: 28,
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              margin: 0,
              maxWidth: 520,
              lineHeight: 1.6,
            }}
          >
            {COPY.footer.disclaimer}
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            <a
              href={COPY.footer.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              {COPY.footer.github}
            </a>
            <a
              href={COPY.footer.xUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textDecoration: 'none', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
            >
              {COPY.footer.x}
            </a>
          </div>
        </div>
      </Container>
    </footer>
  )
}
