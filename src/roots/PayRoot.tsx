/**
 * /pay route — customer pay page wrapped in wallet providers.
 */
import WalletProviders from './WalletProviders'
import PayPage from '../components/PayPage'

export default function PayRoot() {
  return (
    <WalletProviders>
      <PayPage />
    </WalletProviders>
  )
}
