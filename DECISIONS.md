# Settl — Architecture Decisions

## D1 — Wallet library: Privy

ConnectKit and RainbowKit were tried and replaced with Privy (`@privy-io/react-auth` + `@privy-io/wagmi`).
**Reason:** Better mobile modal UX for a POS context. Privy supports injected wallets (MetaMask, Rabby) and embedded wallets via the same `login()` call.
**Constraint:** Privy's embedded wallet uses a smart account internally. The Arc Memo contract (`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`) uses a `CallFrom` precompile that requires the transaction originator to be an EOA. For Memo-wrapped payments, the customer must use an injected EOA wallet (MetaMask, Rabby). Privy embedded wallet users will hit a revert.

## D2 — Memo integration: optional, EOA-only

The payment call routes through `Memo.memo(router, pay(...), invoiceId, memoData)` to record invoice metadata onchain. This is best-effort — if the wallet is a smart contract account, the transaction reverts. A future fix would detect wallet type and fall back to `router.pay()` directly for non-EOA wallets.

## D3 — Contract not redeployed for naming fix

The deployed contract `0x6216af3fb64d039b87088f78da38bd641d62b426` was originally named `ArcTapRouter`. The source file was renamed to `SettlRouter.sol` and the contract to `SettlRouter` in v2. The on-chain bytecode is identical — no redeployment was needed. The `deployments/arc-testnet.json` notes both names.

## D4 — EIP-2612 (permit) and EIP-3009 (transferWithAuthorization): not implemented

Arc Testnet USDC (`0x3600000000000000000000000000000000000000`) support for EIP-2612 and EIP-3009 was not empirically verified — the recon scripts in `recon/` provide the runnable verification steps. Decision: implement standard `approve + pay` sequential flow for now. If EIP-3009 is confirmed supported, a single-signature `payWithAuthorization` path would eliminate one transaction and one wallet confirmation for the customer. This is recorded as future work.

## D5 — EIP-5792 batch not implemented

EIP-5792 `wallet_sendCalls` is not implemented. Most wallets do not yet support it on unknown chains like Arc Testnet. Recorded as future work.

## D6 — simulateContract called before every write (resolved)

`simulateContract` is called before both `approve` and `pay` writes via the `simulate()` helper in `PayPage.tsx`. Revert reasons are surfaced before the wallet prompt with a human-readable error message via `mapRevertError()`. The original blocker (Privy wagmi adapter) was resolved by calling `publicClient.simulateContract` directly rather than through the wagmi write hook.

## D7 — RPC endpoints: rpc.testnet.arc.io

The app uses `https://rpc.testnet.arc.io` (and its WSS equivalent). The audit brief referenced `rpc.testnet.arc.network` as the "spec" endpoint — but Arc Studio's provisioned RPC proxy and `@/onchain-facts` point to `rpc.testnet.arc.io`, which responds correctly. See `recon/FINDINGS.md` for the endpoint verification results.

## D8 — Unused Circle SDK deps removed

## D9 — Mainnet passkey support disabled by default

The passkey wallet flow uses Circle's modular wallet SDK with a chain-specific endpoint
(`/arcTestnet`). The Arc Mainnet equivalent endpoint path and whether smart-account
addresses derived on testnet map to the same address on mainnet has NOT been verified.
USDC sent to an uncontrollable address would be permanently lost.

Decision: `isPasskeyAvailable()` returns false on mainnet unless
`VITE_PASSKEY_MAINNET_ENABLED=true` is set. The owner must confirm with Circle that:
1. The Arc Mainnet modular-wallet endpoint is live and the correct path is `/arc`.
2. Address derivation is deterministic across testnet and mainnet for the same passkey.
Only then should `VITE_PASSKEY_MAINNET_ENABLED` be set to `true` in production.

## D10 — Ethereum mainnet chain removed from wagmi config

The original `config.ts` included `mainnet` (Ethereum chain ID 1) in the wagmi config.
No code in `src/` uses Ethereum mainnet for anything (no ENS, no L1 reads). Keeping it
adds unnecessary bundle weight and expands the surface area of `supportedChains` in Privy,
which could confuse customers. Removed. If ENS resolution is needed in future, add it back.

## D11 — Memo contract: off by default on mainnet

The Arc Memo contract (`0x5294E9927c3306DcBaDb03fe70b92e01cCede505`) is documented as
a testnet predeploy. Its deployment status on Arc Mainnet is unverified. The app defaults
`memoAvailableRef` to `false` on mainnet (bypassing the runtime `eth_getCode` check) so
that payments always fall back to the direct `router.pay()` path. This is correct and safe:
the Paid event is still emitted from the router and verified. If the owner confirms the Memo
contract is deployed on mainnet, set the initial value to `null` in PayPage.tsx to re-enable
the runtime check.

## D12 — History storage is network-scoped

History entries are stored in IndexedDB under network-scoped keys
(`settl:history:v2:mainnet` and `settl:history:v2:testnet`). This ensures testnet test
transactions never appear in a merchant's mainnet history, even if the same device was used
for both. Entries from the legacy `settl:history:v1` key (pre-migration) are not migrated
automatically; merchants who tested on testnet will see an empty history on first mainnet use.

`@circle-fin/developer-controlled-wallets`, `user-controlled-wallets`, `w3s-pw-web-sdk`, `smart-contract-platform`, `adapter-viem-v2`, `app-kit`, `@rainbow-me/rainbowkit`, `connectkit`, and `@web3icons/react` were removed from `package.json`. None of these are imported in `src/` (only `@circle-fin/modular-wallets-core` remains, used in `src/lib/passkey-wallet.ts`).
