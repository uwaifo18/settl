import { useState } from 'react'
import { Container, PrimaryButton } from './primitives'
import { COPY } from './copy'
import SettlLogo from '../../components/SettlLogo'

export default function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { label: COPY.nav.features,    href: '#features' },
    { label: COPY.nav.howItWorks,  href: '#how-it-works' },
    { label: COPY.nav.developers,  href: 'https://x.com/aisuskii?s=11', external: true },
    { label: COPY.nav.faq,         href: '#faq' },
  ]

  const linkStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textDecoration: 'none',
    padding: '12px 4px',
    minHeight: 48,
    display: 'inline-flex',
    alignItems: 'center',
  }

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(11,11,12,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--hairline, #1E1E21)',
      }}
    >
      <Container>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <a href="/app" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            <SettlLogo height={36} variant="dark" />
          </a>

          {/* Desktop nav */}
          <nav aria-label="Main navigation" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <div
              className="landing-desktop-nav"
              style={{ display: 'flex', alignItems: 'center', gap: 20 }}
            >
              {navLinks.map(l => (
                <a
                  key={l.label}
                  href={l.href}
                  style={linkStyle}
                  {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  {l.label}
                </a>
              ))}
            </div>
            <div className="landing-desktop-nav">
              <PrimaryButton href="/app" style={{ height: 40, fontSize: 14, padding: '0 20px', borderRadius: 20 }}>
                {COPY.nav.cta}
              </PrimaryButton>
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="landing-mobile-menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
              style={{
                display: 'none',
                width: 44,
                height: 44,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 10,
                color: 'var(--text)',
              }}
            >
              {menuOpen ? (
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M3 12h18M3 6h18M3 18h18" strokeLinecap="round" />
                </svg>
              )}
            </button>
          </nav>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div
            className="landing-mobile-nav"
            style={{
              borderTop: '1px solid var(--border)',
              padding: '16px 0 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {navLinks.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                style={{ ...linkStyle, padding: '12px 0', fontSize: 16 }}
                {...(l.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {l.label}
              </a>
            ))}
            <PrimaryButton href="/app" style={{ marginTop: 8, width: '100%', borderRadius: 16 }}>
              {COPY.nav.cta}
            </PrimaryButton>
          </div>
        )}
      </Container>

      <style>{`
        @media (max-width: 680px) {
          .landing-desktop-nav { display: none !important; }
          .landing-mobile-menu-btn { display: flex !important; }
        }
        @media (min-width: 681px) {
          .landing-mobile-nav { display: none !important; }
        }
      `}</style>
    </header>
  )
}
