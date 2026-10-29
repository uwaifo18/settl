/**
 * Landing page — /
 * Zero wallet code in this chunk. All sections are plain React + CSS.
 */
import { useEffect } from 'react'
import LandingHeader from './LandingHeader'
import HeroSection from './HeroSection'
import WhyArcSection from './WhyArcSection'
import TapOrScanSection from './TapOrScanSection'
import HowItWorksSection from './HowItWorksSection'
import FeatureRows from './FeatureRows'
import FAQSection from './FAQSection'
import CTASection from './CTASection'
import LandingFooter from './LandingFooter'
import { COPY } from './copy'

export default function LandingPage() {
  // Per-route <title> and meta description
  useEffect(() => {
    document.title = 'Settl: USDC payments at the counter'
    const desc = document.querySelector('meta[name="description"]')
    if (desc) desc.setAttribute('content', 'A USDC point of sale for merchants on Arc. Type an amount, show a code, and your screen turns green in about a second.')
  }, [])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', overflowX: 'hidden' }}>
      {/* Announcement bar */}
      <div
        style={{
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-muted)',
          padding: '10px 16px',
          borderBottom: '1px solid var(--hairline, #1E1E21)',
        }}
      >
        {COPY.announcementBar}
      </div>

      <LandingHeader />

      <main id="main-content">
        <HeroSection />
        <WhyArcSection />
        <TapOrScanSection />
        <HowItWorksSection />
        <FeatureRows />
        <FAQSection />
        <CTASection />
      </main>

      <LandingFooter />
    </div>
  )
}
