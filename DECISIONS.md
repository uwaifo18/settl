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

## D6 — simulateContract not called before writes

`simulateContract` (pre-flight simulation) is not called before `approve` or `pay` writes. This means revert reasons surface only after the wallet signs, which is a degraded UX. Adding it is blocked by the Privy wagmi adapter not exposing `simulateContract` cleanly. Recorded as a known gap.

## D7 — RPC endpoints: rpc.testnet.arc.io

The app uses `https://rpc.testnet.arc.io` (and its WSS equivalent). The audit brief referenced `rpc.testnet.arc.network` as the "spec" endpoint — but Arc Studio's provisioned RPC proxy and `@/onchain-facts` point to `rpc.testnet.arc.io`, which responds correctly. See `recon/FINDINGS.md` for the endpoint verification results.

## D8 — Unused Circle SDK deps removed

`@circle-fin/developer-controlled-wallets`, `user-controlled-wallets`, `w3s-pw-web-sdk`, `smart-contract-platform`, `adapter-viem-v2`, `app-kit`, `@rainbow-me/rainbowkit`, `connectkit`, and `@web3icons/react` were removed from `package.json`. None of these are imported in `src/` (only `@circle-fin/modular-wallets-core` remains, used in `src/lib/passkey-wallet.ts`).
