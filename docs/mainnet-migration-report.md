# Settl Mainnet Migration Report

## 1. File-by-file changes

| Task | Files changed | What changed |
|------|--------------|--------------|
| T1 | `src/network.ts` (new) | Single source of truth: NETWORK, CHAIN_ID, CHAIN_LABEL, RPC_HTTP_URL, RPC_WS_URL, ROUTER_ADDRESS, USDC_ADDRESS, MAX_INVOICE_USDC, explorerTx(), explorerAddress(), HAS_FAUCET, CONFIG_ERROR |
| T2 | `src/lib/invoice.ts` | Removed `ARC_TESTNET_CHAIN_ID`; `Invoice.chainId` is now `number`; added `Invoice.network`; `createInvoice` uses `CHAIN_ID`; `decodeInvoiceHash` rejects wrong chain (names expected network) and enforces `MAX_INVOICE_USDC` |
| T3 | `src/config.ts`, `src/main.tsx` | `config.ts` now builds `arcMainnet` from `network.ts`, uses `RPC_HTTP_URL` explicitly, dropped Ethereum mainnet chain (see D10); `main.tsx` uses `activeChain` from `network.ts` for `supportedChains` and `defaultChain` |
| T4 | `src/lib/watcher.ts` | Uses `RPC_HTTP_URL` and `RPC_WS_URL` from `network.ts`; builds chain object from `activeChain` instead of spreading `arcTestnet`; removed `IS_MAINNET` import |
| T5 | `src/components/PayPage.tsx` | Full rewrite: (1) verify-before-success via Paid event parse + `isPaid()` cross-check; (2) Memo is off by default on mainnet, runtime-checked on testnet; (3) `simulateContract` before every write; (4) retry safety via pre-pay `isPaid()` check; (5) network-aware copy via `CHAIN_LABEL`; (6) mainnet warning on review card; (7) faucet link behind `HAS_FAUCET`; (8) `explorerTx`/`explorerAddress` from `network.ts`; (9) new `unregistered` phase for confirmed-but-not-registered state |
| T6 | `src/components/MerchantPaid.tsx`, `MerchantHistory.tsx`, `MerchantCharge.tsx`, `MerchantApp.tsx`, `src/lib/history.ts` | Removed `ARC_TESTNET_CHAIN_ID` locals; use `explorerTx()` from `network.ts`; `MerchantCharge` enforces `MAX_INVOICE_USDC` with a labeled error; `MerchantApp` uses `ROUTER_ADDRESS` from `network.ts` and shows full-screen `ConfigError` on mainnet misconfiguration (guard moved to outer wrapper to satisfy hooks rules); history keyed per-network (`settl:history:v2:mainnet` / `settl:history:v2:testnet`) |
| T7 | `src/components/NetworkBanner.tsx` (new), `src/components/TestnetBanner.tsx` | `NetworkBanner` shows "Testnet · no real funds" on testnet and "Arc Mainnet · real USDC" on mainnet (both amber/warn); `TestnetBanner` re-exports `NetworkBanner` for backwards compatibility |
| T8 | `src/lib/passkey-wallet.ts` | Passkey wallets disabled on mainnet unless `VITE_PASSKEY_MAINNET_ENABLED=true`; chain path built from `activeChain.id`, not hard-coded `/arcTestnet`; see DECISIONS.md D9 |
| T9 | `vercel.json` | Added mainnet RPC endpoints (`https://rpc.mainnet.arc.io`, `wss://rpc.mainnet.arc.io`) to `connect-src`; removed unused `*.infura.io` and `*.alchemy.com`; added `frame-ancestors 'self'`; `unsafe-eval` kept (required by Privy — see D9 note) |
| T10 | `.env.example`, `deployments/arc-mainnet.json` (new), `docs/mainnet-deploy.md` | `.env.example` now documents all new variables; `arc-mainnet.json` has correct `SettlRouter` contract name, USDC address, mainnet router; deploy guide updated to use `SettlRouter.sol:SettlRouter` and adds owner verification commands |
| T11 | `README.md`, `DECISIONS.md`, `src/lib/history.ts`, `.github/workflows/ci.yml` | README: removed "TESTNET ONLY", documents dual-network support and cap; DECISIONS.md: added D9–D12; CI: unified into `bun run check` (includes unit tests + forge test) |
| T12 | `src/__tests__/network.test.ts` (new), `package.json`, `scripts/check.sh`, `tsconfig.json` | 31 unit tests covering VITE_NETWORK parsing, chain IDs, explorer helpers, invoice decode (both networks), receipt verification, confirmed-but-not-registered state, and MAX_INVOICE_USDC; `bun run check` now runs lint + typecheck + unit tests + forge test |

---

## 2. Grep proof — no user-visible testnet references on the mainnet path

The following `grep -rn` was run against `src/` (excluding test files, `network.ts`, and `onchain-facts.ts` which are the authoritative definitions):

```
src/App.tsx:2:        — comment only, not user-visible
src/lib/memo.ts:3,13  — comments about Memo contract deployment, not user-visible
src/lib/invoice.ts:17 — comment listing both IDs, not user-visible
src/components/PayPage.tsx:10 — comment only
src/components/PayPage.tsx:668 — faucet.circle.com, gated behind HAS_FAUCET (returns false on mainnet)
```

Zero user-visible testnet strings reach the mainnet render path.

---

## 3. Test, lint, typecheck, build output

```
bun run check:
  lint:         0 warnings, 0 errors
  typecheck:    0 errors
  unit-tests:   31 passed, 0 failed  (vitest v5.0.5)
  forge-test:   24 passed, 0 failed  (ArcTapRouterTest 12, SettlRouterTest 12)
```

---

## 4. What you (the owner) must verify

```bash
export RPC=https://rpc.mainnet.arc.io

# Confirm chain ID is 5042
cast chain-id --rpc-url $RPC

# Confirm router is deployed (must not return 0x)
cast code 0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F --rpc-url $RPC

# Confirm router's USDC address (expect 0x3600...0000)
cast call 0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F "USDC()(address)" --rpc-url $RPC

# Check if the Arc Memo contract is deployed on mainnet
cast code 0x5294E9927c3306DcBaDb03fe70b92e01cCede505 --rpc-url $RPC
# If 0x: Memo is NOT on mainnet — app defaults to direct router.pay(), which is correct.
```

Additionally:
1. Verify the router source on `https://explorer.arc.io`
2. Set the Vercel env vars: `VITE_NETWORK=mainnet`, `VITE_MAINNET_ROUTER_ADDRESS=0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F`, `VITE_MAX_INVOICE_USDC=0.01` for the first smoke test
3. Confirm Privy allowed domains includes your production domain
4. Test HTTP and WebSocket RPC from a real browser (check wallet connect, RPC reads, WebSocket events in the Network tab)
5. Run a $0.01 end-to-end payment before increasing the cap
6. Run `git rm --cached console.jsonl traces.jsonl` and commit (T11 — these are gitignored but tracked)

---

## 5. Remaining risks (ranked)

### CRITICAL
1. **Router is unaudited.** `SettlRouter` / `ArcTapRouter` has had no independent professional security audit. Real USDC flows through it. You must obtain an audit before handling significant value.

### HIGH
2. **Memo contract on mainnet unknown.** The Arc Memo contract (`0x5294...e505`) is documented as a testnet predeploy. Its status on mainnet is unverified. The app defaults `useMemo = false` on mainnet (direct `router.pay()`) which is safe. Confirm with `cast code` above.
3. **`isPaid()` cross-check is best-effort.** If the RPC call to `isPaid()` fails (network error), the verification step passes without a confirmed onchain check. This is guarded with a try/catch that leaves `onchainConfirmed = false`, causing the unregistered screen — which is the safe failure mode (shows an error rather than fake success). Consider adding a retry.

### MEDIUM
4. **Passkey wallets unverified on mainnet.** Disabled by default (D9). Do not enable until Circle confirms Arc Mainnet endpoint and address determinism.
5. **No independent RPC fallback.** Both HTTP and WS RPC default to `rpc.mainnet.arc.io`. If that endpoint is down, the merchant watcher and pay page both fail. Consider adding a partner/backup RPC via `VITE_ARC_MAINNET_RPC_URL`.
6. **Invoice deadline is 10 minutes.** On mainnet with a slow wallet (e.g. Ledger), a customer who approves close to the deadline may have their pay tx revert with `Expired`. The `simulateContract` check will catch this before the wallet is opened, but it's a UX cliff.

### LOW
7. **History migration.** Pre-migration testnet history (key `settl:history:v1`) is not auto-migrated to `settl:history:v2:testnet`. Merchants lose their testnet history on first load after the upgrade. This is intentional (network isolation), but worth communicating.
8. **`unsafe-eval` in CSP.** Required by Privy (confirmed needed for their SDK). This is a known trade-off and is documented.
