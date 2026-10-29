/**
 * wagmi configuration for Settl — using @privy-io/wagmi createConfig.
 * All network values come from src/network.ts.
 */

import { http } from 'wagmi'
import { createConfig } from '@privy-io/wagmi'
import { activeChain, RPC_HTTP_URL, CHAIN_ID } from './network'
import { registerChain } from './tracing'

// Re-export activeChain so callers that import from @/config keep working.
export { activeChain }

// Pre-register chain RPC URL so trace events show the correct chain name immediately.
registerChain(CHAIN_ID, RPC_HTTP_URL)

export const config = createConfig({
  chains: [activeChain] as const,
  transports: {
    [activeChain.id]: http(RPC_HTTP_URL),
  } as Record<typeof activeChain.id, ReturnType<typeof http>>,
})
