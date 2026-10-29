/**
 * Wallet providers (Privy + wagmi + QueryClient).
 * Imported only by MerchantRoot and PayRoot so the landing page chunk
 * never pulls in any wallet SDK.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from '@privy-io/wagmi'
import { PrivyProvider } from '@privy-io/react-auth'
import { Toaster } from 'sonner'
import { config, activeChain } from '../config'
import type { ReactNode } from 'react'

const PRIVY_APP_ID =
  (import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ||
  'cmsme6edh01ig0cjj1do2eqx2'

const queryClient = new QueryClient()

export default function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: { theme: 'dark', accentColor: '#2563eb', logo: undefined },
        supportedChains: [activeChain],
        defaultChain: activeChain,
        loginMethods: ['wallet', 'email'],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          {children}
          <Toaster position="top-center" />
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  )
}
