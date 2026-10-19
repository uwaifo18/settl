# ArcTap — USDC Point of Sale

## Contract Deployments

### ArcTapRouter — Arc Testnet (chain 5042002)
- **Address:** `0x6216af3fb64d039b87088f78da38bd641d62b426`
- **Tx:** `0x1a4b8808443627f397f113970c1b034e96f6591456247834b26e836b7ee870cb`
- **Explorer:** https://explorer.testnet.arc.io/address/0x6216af3fb64d039b87088f78da38bd641d62b426
- **USDC:** `0x3600000000000000000000000000000000000000` (6 decimals)
- **VITE_ROUTER_ADDRESS:** must be set in .env

---

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

[Brief description of what the app does and its primary use case]

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
