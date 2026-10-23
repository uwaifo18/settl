# Phase 0 Reconnaissance Findings

**Date:** 2026-10-23  
**Chain:** Arc Testnet (chain ID 5042002)  
**USDC:** `0x3600000000000000000000000000000000000000`

---

## 1. RPC Endpoint Verification

| Endpoint | Type | Status | Notes |
|----------|------|--------|-------|
| `https://rpc.testnet.arc.io` | HTTP | RESPONDS | Used by Arc Studio and this app |
| `wss://rpc.testnet.arc.io` | WebSocket | RESPONDS | Used for event subscription |
| `https://rpc.testnet.arc.network` | HTTP | NOT VERIFIED | Referenced in spec; not tested in this session |
| `https://testnet.arcscan.app` | Explorer | NOT VERIFIED | Spec explorer; app uses `explorer.testnet.arc.io` |

**Decision (D7):** App continues to use `rpc.testnet.arc.io` — this is what Arc Studio's RPC proxy and `@/onchain-facts` module provide. See DECISIONS.md D7.

### Verification script

```bash
# Verify RPC endpoints respond
curl -s -X POST https://rpc.testnet.arc.io \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
# Expected: {"result":"0x4CEF12"} (0x4CEF12 = 5042002)
```

---

## 2. USDC ERC-20 Behavior

Arc Testnet USDC (`0x3600000000000000000000000000000000000000`) is a special address — it is both the native gas token AND the ERC-20 USDC. It has **6 decimals** in ERC-20 view and more decimals in the native view. The app uses the ERC-20 view exclusively for all balance/transfer/approve operations.

**NOT VERIFIED in this session:** `name()`, `symbol()`, `decimals()` live calls. The app hard-codes 6 decimals from `@/onchain-money.ts` — this is correct per Arc documentation.

---

## 3. EIP-2612 (permit) Support

**NOT VERIFIED empirically.**  
To verify, run:
```bash
# Check if USDC has nonces() function (required for EIP-2612)
cast call 0x3600000000000000000000000000000000000000 \
  "nonces(address)(uint256)" \
  0x0000000000000000000000000000000000000001 \
  --rpc-url https://rpc.testnet.arc.io
```
If this returns a uint256 without reverting, EIP-2612 is supported.

---

## 4. EIP-3009 (transferWithAuthorization) Support

**NOT VERIFIED empirically.**  
To verify:
```bash
cast call 0x3600000000000000000000000000000000000000 \
  "transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)" \
  --rpc-url https://rpc.testnet.arc.io 2>&1 | head -5
# If it returns "function not found" revert, EIP-3009 is NOT supported.
```
**Decision (D4):** Not implemented. If confirmed supported, a single-sig `payWithAuthorization` flow eliminates one wallet confirmation. See DECISIONS.md D4.

---

## 5. WebSocket Log Latency

**NOT VERIFIED empirically** (requires 10 live transfers).  
Manual test procedure:
1. Open the merchant app, create a 0.01 USDC invoice
2. Open the pay page in another browser
3. Note the timestamp when you confirm the transaction in the wallet
4. Note the timestamp when the PAID screen appears on the merchant side
5. Repeat 10 times and compute the median

Expected: < 3 seconds (Arc has sub-second block times; WebSocket push adds ~1s).

---

## 6. Finality Semantics

Arc uses a BFT consensus mechanism with **single-slot finality** — a block is final as soon as it is included. There is no "safe" vs "finalized" distinction as on Ethereum. A transaction in a confirmed block is irreversible.

**Source:** Arc documentation (https://docs.arc.io)  
**Implication:** The app can safely show PAID as soon as `waitForTransactionReceipt` returns — no additional finality delay needed.

---

## 7. Wallet Compatibility (wallet_getCapabilities / EIP-5792)

**NOT VERIFIED empirically.**  
Most injected wallets (MetaMask, Rabby) do not yet support `wallet_getCapabilities` on unknown chains like Arc Testnet (chain 5042002). EIP-5792 batch transactions are recorded as future work (DECISIONS.md D5).

---

## 8. Gas Cost Table (in USDC)

**NOT VERIFIED empirically** (requires live testnet transactions with gas measurement).

Approximate gas costs based on Arc documentation (USDC is native gas; fees are stable and low):

| Operation | Approx. Gas Units | Approx. Cost in USDC |
|-----------|-------------------|----------------------|
| `transfer` | ~21,000–65,000 | < $0.001 |
| `approve` | ~46,000 | < $0.001 |
| `pay` (router) | ~65,000 | < $0.001 |
| `approve + pay` | ~111,000 | < $0.001 |

Arc gas fees are denominated in USDC and are extremely low by design (sub-cent). The app does not display estimated fees to the user — this is a known gap (AUDIT.md P3).

**To measure empirically:**
```bash
# After running a transaction, check the receipt for gasUsed
cast receipt <TX_HASH> --rpc-url https://rpc.testnet.arc.io | grep gasUsed
# Multiply gasUsed × effectiveGasPrice (in native USDC units) to get fee
```
