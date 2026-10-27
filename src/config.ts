/**
 * wagmi configuration for Settl — using @privy-io/wagmi createConfig
 * Built with Arc Studio — https://studio.arc.io
 */

import { http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { defineChain } from 'viem'
import { createConfig } from '@privy-io/wagmi'
import { registerChain } from './tracing'

// Arc Mainnet (chain ID 5042)
export const arcMainnet = defineChain({
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
})

// Which Arc network to use — set VITE_NETWORK=mainnet in Vercel for production
export const IS_MAINNET = import.meta.env.VITE_NETWORK === 'mainnet'
export const activeChain = IS_MAINNET ? arcMainnet : arcTestnet

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(activeChain.id, activeChain.rpcUrls.default.http[0])

export const config = IS_MAINNET
  ? createConfig({
      chains: [arcMainnet, mainnet] as const,
      transports: {
        [arcMainnet.id]: http(),
        [mainnet.id]: http(),
      },
    })
  : createConfig({
      chains: [arcTestnet, mainnet] as const,
      transports: {
        [arcTestnet.id]: http((import.meta.env.VITE_ARC_RPC_URL as string | undefined) ?? undefined),
        [mainnet.id]: http(),
      },
    })
