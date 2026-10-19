/**
 * wagmi configuration for ArcTap
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'ArcTap' }),
  ...(walletConnectProjectId
    ? [walletConnect({ projectId: walletConnectProjectId, metadata: { name: 'ArcTap', description: 'USDC Point of Sale on Arc', url: 'https://arctap.app', icons: [] } })]
    : []),
]

export const config = createConfig({
  chains: [arcTestnet, mainnet], // mainnet needed for ENS resolution
  connectors,
  transports: {
    [arcTestnet.id]: http((import.meta.env.VITE_ARC_RPC_URL as string | undefined) ?? undefined),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
