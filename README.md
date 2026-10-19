# Settl — USDC Point-of-Sale on Arc Testnet

A merchant opens this Progressive Web App, types a USDC amount, and gets a QR code (plus NFC write on supported Android). The customer scans or taps, connects a wallet, and confirms. Arc's sub-second finality and USDC-as-gas mean the merchant screen flips to a big green **PAID** within about a second of the transaction landing. No backend, no custody, no merchant keys on the device.

> **TESTNET ONLY. No real funds.**

---

## Arc Memo Integration

Settl uses **Arc Transaction Memos** — a predeployed system contract on Arc that attaches structured metadata to any contract call without modifying the target contract.

### How it works

Instead of calling `ArcTapRouter.pay(...)` directly, the customer's wallet calls:

```
Memo.memo(
  target  = ArcTapRouter address,
  data    = abi.encode(pay(invoiceId, merchant, amount, deadline)),
  memoId  = invoiceId,            // 32 bytes — indexed for lookup
  memoData = UTF-8 JSON bytes     // { app, businessName, note, invoiceId, amountUsdc }
)
```

Arc's `CallFrom` precompile preserves `msg.sender` through the wrapper, so `ArcTapRouter` still sees the customer's EOA as the payer. Two events are emitted per payment:

1. `Paid(invoiceId, merchant, payer, amount)` — from ArcTapRouter (for settlement)
2. `Memo(sender, target, callDataHash, memoId, memo, memoIndex)` — from the Memo contract (for reconciliation)

### Memo contract

| Property | Value |
|---|---|
| Address | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` |
| Network | Arc Testnet |
| Docs | https://docs.arc.io/arc/concepts/transaction-memos |

### What this enables

- Every payment has an **immutable onchain record** with the business name and memo note, permanently queryable by `memoId` (= `invoiceId`)
- Merchants, wallets, and indexers can reconcile payments against invoices without any offchain database
- ArcScan shows both events on the same transaction — full audit trail at a glance
- The merchant's history screen shows an "⛓ onchain" badge next to the note when the Memo event was decoded

### Constraints

- Only **EOA wallets** are supported (MetaMask, Coinbase Wallet, Rabby, Rainbow, hardware wallets)
- Smart contract wallets (ERC-4337, Safe multisig, Circle modular wallets) will revert — the payment falls back to the standard `router.pay()` path automatically

---

## Architecture

```
Browser (merchant)          Browser (customer)
   MerchantApp                   PayPage
       |                             |
   localStorage              URL hash fragment
  (settings)                  (invoice params)
       |                             |
   watcher.ts               wagmi + ConnectKit
  (viem WS/HTTP)                  |
       |                   SettlRouter.pay()
       +------>  SettlRouter  <------+
                (Arc Testnet)
                     |
              USDC.safeTransferFrom
                (merchant gets funds)
```

**Flow:**
1. Merchant enters amount → `createInvoice()` → QR code with pay URL (hash fragment)
2. Customer scans QR → `/pay` page decodes invoice from hash → validate → approve + pay
3. Merchant watcher subscribes to `Paid(invoiceId, merchant, payer, amount)` event via WS + polling fallback
4. On matching event, verify `isPaid()` onchain → show PAID + chime + haptics

---

## Phase 0 Recon Findings

| Question | Finding |
|---|---|
| `arcTestnet` in viem/chains? | **Yes** — built-in, no custom definition needed |
| USDC 0x3600...0000 standard ERC-20? | **Yes** — approve/allowance/transferFrom/transfer all work with 6 decimals |
| EIP-2612 permit support? | Not verified — skipped; using sequential approve+pay |
| EIP-3009 transferWithAuthorization? | Not verified — skipped; using sequential approve+pay |
| WS `eth_subscribe` logs? | **Yes** — wss://rpc.testnet.arc.io supports it |
| Block time? | ~sub-second on Arc Testnet (deterministic finality) |
| Confirmations for finality? | Arc has single-block finality — 1 confirmation is final |
| Typical gas cost? | ~80k gas for `approve`+`pay` (shown in forge gas report); gas is paid in USDC |
| Wallet EIP-5792 batching? | Not relied upon — using sequential approve+pay as primary path |

---

## Setup

```bash
# 1. Install deps
bun install

# 2. Copy env example
cp .env.example .env
# Fill in VITE_ROUTER_ADDRESS (see deployments/arc-testnet.json)
# Optionally add VITE_WALLETCONNECT_PROJECT_ID

# 3. Run dev server
bun run dev
```

### Get testnet USDC

Use the **Get test USDC** button in Arc Studio's sidebar, or visit https://faucet.circle.com.

---

## Contract

**SettlRouter (ArcTapRouter)** is deployed on Arc Testnet:
- Address: `0x6216af3fb64d039b87088f78da38bd641d62b426`
- Tx: `0x1a4b8808443627f397f113970c1b034e96f6591456247834b26e836b7ee870cb`
- Explorer: https://explorer.testnet.arc.io/address/0x6216af3fb64d039b87088f78da38bd641d62b426

### Deploy your own

```bash
# Build
forge build

# Deploy (Foundry encrypted keystore recommended)
cast wallet import deployer --interactive
forge script contracts/script/Deploy.s.sol \
  --rpc-url https://rpc.testnet.arc.io \
  --account deployer \
  --broadcast

# Update deployments/arc-testnet.json and VITE_ROUTER_ADDRESS
```

### Run tests

```bash
forge test --gas-report
```

All 12 tests pass — happy path, event args, balance delta, expired deadline, double pay, zero amount, zero merchant, insufficient allowance, insufficient balance, merchant independence, router-always-zero, fuzz on amounts.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_ROUTER_ADDRESS` | Yes | Deployed ArcTapRouter address |
| `VITE_WALLETCONNECT_PROJECT_ID` | No | For WalletConnect support (free at cloud.walletconnect.com) |
| `VITE_ARC_RPC_URL` | No | Override Arc Testnet HTTP RPC |
| `VITE_ARC_WS_URL` | No | Override Arc Testnet WS URL |
| `ARC_TESTNET_RPC_URL` | Deploy only | For forge scripts |

---

## Security Checklist

- **Router address allow-listed:** pay page reads `VITE_ROUTER_ADDRESS` from build env, validates `r` param in URL equals this address. Never trusts URL router param.
- **URL params validated:** every param length-capped, addresses checksummed, amounts checked >0, chain ID checked == 5042002, invoice ID checked == 32 bytes hex, deadline checked in future.
- **name/memo rendered as text:** no `dangerouslySetInnerHTML`.
- **Invoice IDs cryptographically random:** `crypto.getRandomValues(32 bytes)`.
- **Approvals exact-amount:** never infinite approve. Skips approve when allowance is already sufficient.
- **Chain ID checked before every write:** wagmi chainId check + auto-switch prompt.
- **No private keys in web app:** merchant app only knows a receiving address and watches the chain.
- **PAID only after onchain verification:** log verified (invoiceId, merchant, amount >= requested, not removed) + `isPaid()` cross-check.

### Known Limitations

- Testnet only; unaudited contract
- A physical attacker who swaps a QR sticker could direct payments to a different address. Mitigated by showing the full merchant address to the customer before signing.
- NFC write ("tap tag to open payment") is **not** contactless payment — it just opens the payment URL. Requires Android Chrome + NDEFReader API.
- No refunds; no multi-token; no fiat conversion (see Future Work).

---

## 60-Second Demo Script

1. Open the app on your phone and tap **Set up Settl**
2. Paste your Arc Testnet wallet address (get one from MetaMask) and tap **Start Accepting Payments**
3. Type `1.00` and tap **Charge $1.00 USDC**
4. A QR code appears — scan it with a second phone (or the same device)
5. Connect a funded wallet → review invoice → **Approve** → **Pay**
6. Merchant screen turns green with a chime in about 1 second
7. Tap **View on ArcScan** for the transaction link

---

## Future Work (Out of Scope)

Fiat conversion, refunds, multi-token support, mainnet, user accounts, a backend, fees or revenue share, tipping.
