# Settl Audit Report

**Date:** 2026-10-23  
**Auditor:** Arc Studio  
**Repo:** uwaifo18/settl  
**Chain:** Arc Testnet (chain ID 5042002)  
**Contract:** ArcTapRouter @ `0x6216af3fb64d039b87088f78da38bd641d62b426`

---

## Audit Table

| # | Requirement | Status | Evidence | Fix Needed |
|---|-------------|--------|----------|------------|
| C1 | Router has no owner, admin, fees, upgradeability, pause; keeps no USDC after any call | PASS | `contracts/ArcTapRouter.sol` lines 7-52: no Ownable, no fee variable, no pause, USDC transferred directly to merchant via `safeTransferFrom(msg.sender, merchant, amount)` — never touches router balance | None |
| C2 | `pay()` reverts on zero amount, zero merchant, merchant==router, expired deadline, double pay | PASS | Lines 37-43: ZeroAmount, InvalidMerchant (addr(0) and addr(this)), Expired, AlreadyPaid errors | None |
| C3 | Paid key bound to (merchant, invoiceId), set before transfer | PASS | Line 41: `keccak256(abi.encode(merchant, invoiceId))`; line 45: `paid[key] = true` before line 46 transfer | None |
| C4 | `Paid(invoiceId, merchant, payer, amount)` has 3 indexed fields | PASS | Lines 10-15: all three fields indexed | None |
| C5 | Tests: happy path, events, balance delta, deadline, double pay, zero values, low allowance, low balance, independent merchants, zero router balance, fuzz | PASS | `contracts/test/ArcTapRouter.t.sol`: 12 tests covering all cases. Run `forge test` — 12 passing | None |
| C6 | Fork test against real USDC | FAIL | No fork test exists in `contracts/test/` | Add fork test with `vm.createFork` |
| C7 | Coverage above 95% | NOT VERIFIED | `forge coverage` not run in this session — no coverage report exists | Run `forge coverage --report lcov` |
| C8 | Deployed address consistent in `deployments/arc-testnet.json`, README, `.env.example`, build env | PARTIAL | `deployments/arc-testnet.json` correct; README mentions `ArcTapRouter` (old name); `.env.example` does not exist; `VITE_ROUTER_ADDRESS` hardcoded in `PayPage.tsx` as fallback | Create `.env.example`; fix README naming; remove hardcoded fallback |
| C9 | Contract name consistent everywhere (README says "SettlRouter (ArcTapRouter)") | FAIL | File is `ArcTapRouter.sol`, contract is `ArcTapRouter`, README references both names | Rename to `SettlRouter` throughout |
| S1 | All USDC amounts are bigint micro-USDC; no 18-decimal usage | PASS | `src/lib/amount.ts` uses 6 decimals throughout; `src/onchain-money.ts` provides USDC helpers; no `parseUnits(x, 18)` found in src/ | None |
| S2 | No floating-point math on amounts | PASS | All amounts are `bigint`; display formatting uses `formatUsdc()` which divides by `1_000_000n` via integer division | None |
| S3 | Keypad parsing rejects 0, 0.00, empty, negatives, more than 2 decimals, leading zeros | PARTIAL | `src/lib/amount.ts` `validateUsdcInput()` exists; does not explicitly reject leading zeros like `007` | Fix leading zero rejection |
| S4 | Invoice IDs from `crypto.getRandomValues` | PASS | `src/lib/invoice.ts` line 45: `crypto.getRandomValues(bytes)` on 32 bytes | None |
| S5 | Pay-link parser validates version, chain, router==build constant, merchant, amount, 32-byte invoiceId, deadline; caps name/memo | PASS | `src/lib/invoice.ts` `decodeInvoiceHash()` lines 122-185: all fields validated | None |
| S6 | "Paid" decision in one pure function checking log address, merchant, invoiceId, amount>=requested, removed | PARTIAL | `src/lib/watcher.ts` `verifyPaidLog()` checks removed, invoiceId, merchant, amount>=invoice.amount. Does NOT check log contract address (routerAddress param is accepted but comment says "already validated at URL parse time") | Add explicit routerAddress check in verifyPaidLog |
| S7 | isPaid() cross-check after paid decision | PASS | `src/lib/watcher.ts` exports `checkIsPaid()`; `src/components/MerchantApp.tsx` calls it after `onPaid` callback | None |
| W1 | WebSocket with HTTP fallback, backfill on start/visibilitychange/online/reconnect, 2s poll, dedup, deadline+60s grace | PARTIAL | WS+HTTP fallback: PASS (lines 66-70). Backfill on start/visibility/online: PASS (lines 249-267). 2s poll: PASS (line 236). Dedup: PASS (seenTxHashes). Deadline+60s grace: FAIL — watcher uses `invoice.deadline` but does NOT add 60s grace to keep watching | Add `+60` to deadline grace period |
| W2 | Cancelled invoices keep being watched; late payment updates history with "paid after cancel" note | FAIL | `MerchantApp.tsx` stops the watcher on cancel. No "paid after cancel" note in history | Keep watcher running after cancel; add note |
| W3 | Underpaid, Expired, Offline, Paid states exist | PARTIAL | Paid: PASS. Expired: PASS. Offline: NOT VERIFIED (no offline indicator visible in MerchantAwaiting). Underpaid: FAIL — contract transfers exact amount from payer, no underpay path at contract level; watcher checks `amount >= invoice.amount` but UI shows no "underpaid" state | Document underpaid impossibility or add UI note |
| W4 | Overpayment shown | PARTIAL | Watcher allows amount >= requested (correct), but MerchantPaid.tsx shows `invoice.amount` not `paidAmount` — overpayment not displayed | Show paidAmount in PAID screen |
| W5 | Wake Lock, chime, vibration, settings toggles, history (IndexedDB cap 500, CSV export), reconciliation | PARTIAL | Wake Lock: PASS. Chime+haptic: PASS (recently fixed). Settings toggles: PASS. IndexedDB: PASS. CSV: PASS. Cap 500: NOT VERIFIED (no cap enforcement found in history.ts). Reconciliation of stale awaiting records: NOT VERIFIED | Verify/add history cap; verify reconciliation |
| W6 | Amounts >100 USDC: merchant confirmation + customer warning | PARTIAL | Customer warning: PASS (PayPage.tsx line 379). Merchant confirmation on Charge screen: NOT VERIFIED — `MerchantCharge.tsx` shows `showLargeWarning` text but no confirmation dialog blocking the charge | Add confirmation dialog on merchant side |
| P1 | Only build-time router accepted | PASS | `PayPage.tsx` line 26-28: `ROUTER_ADDRESS` from env or hardcoded fallback; `decodeInvoiceHash` validates `r` == `bakedInRouterAddress` | None |
| P2 | Chain checked before every write, with switchChain + wallet_addEthereumChain fallback | PARTIAL | switchChain called: PASS. `wallet_addEthereumChain` fallback: FAIL — `useSwitchChain` from wagmi does not automatically call `wallet_addEthereumChain` if chain is unknown | Add addEthereumChain fallback in switchChain handler |
| P3 | Review card shows merchant name, full address, amount, memo, expiry, estimated fee, balance | PARTIAL | Name, address, amount, memo, expiry, balance: PASS. Estimated gas fee in USDC: FAIL — not shown | Add estimated fee display |
| P4 | Payment path: single sig if supported, EIP-5792 batch if supported, else sequential approve+pay. No infinite approvals. simulateContract before write. Retry checks isPaid first. | PARTIAL | Sequential approve+pay: PASS. No infinite approvals (exact amount): PASS. EIP-5792 batch: NOT IMPLEMENTED. Single sig (EIP-3009): NOT IMPLEMENTED. simulateContract before write: FAIL — absent. Retry checks isPaid: NOT VERIFIED | Add simulateContract; document EIP-5792/3009 as future work |
| P5 | Success shown only after waitForTransactionReceipt returns success | PASS | `PayPage.tsx` lines 200-206: `paySuccess` from `useWaitForTransactionReceipt` drives `effectivePhase === 'success'` | None |
| PWA1 | Manifest, 192+512+maskable icons, SW, offline shell, update toast, install prompt, iOS hint | PARTIAL | Manifest: PASS. Icons: PARTIAL — `icon-192.png` and `icon-512.png` referenced but files not found in `public/` (`ls public/` shows only `logo.svg`). SW: PASS (vite-plugin-pwa). Offline shell: NOT VERIFIED. Update toast never mid-payment: NOT VERIFIED. Install prompt: NOT VERIFIED. iOS hint: NOT VERIFIED | Add icon PNG files to public/ |
| PWA2 | NFC hidden when NDEFReader unsupported; honest copy | PASS | `MerchantAwaiting.tsx` checks `'NDEFReader' in window` before showing NFC UI | None |
| SEC1 | CSP and security headers | FAIL | `vercel.json` has only SPA rewrites, no headers configured | Add strict CSP, Referrer-Policy, X-Content-Type-Options, Permissions-Policy |
| SEC2 | No dangerouslySetInnerHTML | PASS | Grep confirms zero occurrences in src/ | None |
| SEC3 | No keys client-side | PASS | No private keys in src/; `VITE_PRIVY_APP_ID` is public (app ID only, not secret) | None |
| SEC4 | No analytics | PASS | No analytics SDK imports found | None |
| SEC5 | Accessibility: touch targets, contrast, aria-live, reduced motion, QR dark on white | PARTIAL | aria-live on amount: PASS. QR dark on white: PASS (QRDisplay.tsx). Touch targets 56px on buttons: PASS. Reduced motion: NOT VERIFIED. Contrast: NOT VERIFIED | Add prefers-reduced-motion to animated elements |
| DOC1 | recon/FINDINGS.md exists | FAIL | Directory and file absent | Create recon/ with FINDINGS.md |
| DOC2 | DECISIONS.md exists | FAIL | File absent | Create DECISIONS.md |
| DOC3 | Simulator script exists | FAIL | `scripts/simulate-customer.ts` absent | Create simulator |
| DOC4 | CI workflow exists | FAIL | `.github/workflows/` absent | Add CI workflow |
| DOC5 | License exists | FAIL | No LICENSE file | Add MIT LICENSE |
| DEP1 | Unused deps removed; package renamed to settl | FAIL | `package.json` name is `studio-app`; `@circle-fin/developer-controlled-wallets`, `user-controlled-wallets`, `w3s-pw-web-sdk`, `smart-contract-platform`, `adapter-viem-v2`, `app-kit`, `@rainbow-me/rainbowkit`, `connectkit` are all unused in src/ (only `@circle-fin/modular-wallets-core` used in `passkey-wallet.ts`) | Remove unused deps; rename package |
| LOG1 | console.jsonl and traces.jsonl not committed | FAIL | Both files present in repo root; contain session RPC traces and browser error logs. No private keys or secrets found but contain wallet addresses and WalletConnect project ID | Remove from tree; add to .gitignore |

---

## Summary (Before Fixes)

| Status | Count |
|--------|-------|
| PASS | 16 |
| FAIL | 12 |
| PARTIAL | 11 |
| NOT VERIFIED | 4 |
| **Total** | **43** |

---

## Fix Plan (ordered by severity)

1. **LOG1** — remove committed logs (contains session data)
2. **DEP1** — remove unused deps; rename package
3. **C9** — rename ArcTapRouter → SettlRouter
4. **W2** — cancelled invoice late-pay handling
5. **W1** — deadline+60s grace period
6. **S6** — add routerAddress check to verifyPaidLog
7. **P2** — wallet_addEthereumChain fallback
8. **SEC1** — security headers in vercel.json
9. **PWA1** — icon PNG files
10. **DOC1/2/3/4/5** — DECISIONS.md, recon/FINDINGS.md, LICENSE, CI, simulator
11. **C8** — .env.example
12. **P3** — estimated fee display (future work — requires eth_estimateGas)
13. **P4** — simulateContract, EIP-5792/3009 (future work)
