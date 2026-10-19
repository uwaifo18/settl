/**
 * wagmi configuration for Settl — using @privy-io/wagmi createConfig
 * Built with Arc Studio — https://studio.arc.io
 */

import { http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { createConfig } from '@privy-io/wagmi'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnet, mainnet],
  transports: {
    [arcTestnet.id]: http((import.meta.env.VITE_ARC_RPC_URL as string | undefined) ?? undefined),
    [mainnet.id]: http(),
  },
})
