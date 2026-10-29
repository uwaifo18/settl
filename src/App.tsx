/**
 * Settl — App router.
 * Routes:
 *   /        → Landing page (no wallet code)
 *   /app     → Merchant app (Privy + wagmi providers scoped here)
 *   /pay     → Customer pay page (Privy + wagmi providers scoped here)
 *
 * Providers are NOT at root level so the landing page chunk stays wallet-free.
 */

import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

const LandingPage  = lazy(() => import('./features/landing/LandingPage'))
const MerchantRoot = lazy(() => import('./roots/MerchantRoot'))
const PayRoot       = lazy(() => import('./roots/PayRoot'))

function PageSpinner() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0B0B0C',
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '2.5px solid #2A2A2E',
          borderTopColor: '#35D49A',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export default function App() {
  // If an installed PWA opens at '/' in standalone mode, redirect to /app
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true

  return (
    <BrowserRouter>
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          <Route
            path="/"
            element={isStandalone ? <Navigate to="/app" replace /> : <LandingPage />}
          />
          <Route path="/app" element={<MerchantRoot />} />
          <Route path="/pay" element={<PayRoot />} />
          {/* Redirect anything unknown to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
