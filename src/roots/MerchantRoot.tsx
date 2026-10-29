/**
 * /app route — merchant PWA wrapped in wallet providers.
 */
import WalletProviders from './WalletProviders'
import MerchantApp from '../components/MerchantApp'

export default function MerchantRoot() {
  return (
    <WalletProviders>
      <MerchantApp />
    </WalletProviders>
  )
}
