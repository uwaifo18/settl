/**
 * wagmi + RainbowKit configuration for Settl
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import {
  injectedWallet,
  metaMaskWallet,
  coinbaseWallet,
  rainbowWallet,
  walletConnectWallet,
  rabbyWallet,
  safeWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { connectorsForWallets } from '@rainbow-me/rainbowkit'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

const walletConnectProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? ''

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        injectedWallet,
        metaMaskWallet,
        coinbaseWallet,
        rainbowWallet,
        rabbyWallet,
        safeWallet,
        ...(walletConnectProjectId ? [walletConnectWallet] : []),
      ],
    },
  ],
  {
    appName: 'Settl',
    projectId: walletConnectProjectId || 'settl-app',
  }
)

export const config = createConfig({
  chains: [arcTestnet, mainnet],
  connectors,
  transports: {
    [arcTestnet.id]: http((import.meta.env.VITE_ARC_RPC_URL as string | undefined) ?? undefined),
    [mainnet.id]: http(),
  },
})
