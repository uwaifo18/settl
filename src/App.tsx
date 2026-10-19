/**
 * ArcTap — USDC Point of Sale on Arc Testnet
 * Routes: / (merchant app), /pay (customer pay page)
 */

import { useEffect, useState } from 'react'
import MerchantApp from './components/MerchantApp'
import PayPage from './components/PayPage'

export default function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    function onPopState() { setPath(window.location.pathname) }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  if (path.startsWith('/pay')) {
    return <PayPage />
  }

  return <MerchantApp />
}
