# Mainnet Deploy Guide

> **You must complete every step below yourself.**
> Arc Studio does not deploy to, sign for, or transact on mainnet.

---

## 0. Owner verification checklist (run these FIRST)

```bash
export RPC=https://rpc.mainnet.arc.io

# Confirm chain ID is 5042
cast chain-id --rpc-url $RPC

# Confirm router is deployed (must not return 0x)
cast code 0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F --rpc-url $RPC

# Confirm router's USDC address matches (expect 0x3600...0000)
cast call 0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F "USDC()(address)" --rpc-url $RPC

# Check if the Arc Memo contract is deployed on mainnet
cast code 0x5294E9927c3306DcBaDb03fe70b92e01cCede505 --rpc-url $RPC
# If this returns 0x, the Memo wrapper is NOT deployed on mainnet.
# The app defaults to direct router.pay() on mainnet — this is correct and safe.
```

---

## 1. Router deployment (only if re-deploying from source)

The mainnet router is already deployed at `0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F`.
You only need to re-deploy if you changed the contract source.

### Prerequisites
- Foundry installed (`foundryup`)
- A funded Arc Mainnet wallet (USDC is the gas token on Arc)
- Bridge USDC to Arc Mainnet via https://bridge.arc.io

### Create an encrypted keystore (never use --private-key in plain text)

```bash
cast wallet import settl-deployer --interactive
# Enter your private key when prompted, then set a password
# This creates ~/.foundry/keystores/settl-deployer
```

### Deploy

```bash
cd /path/to/settl
forge build

forge create contracts/SettlRouter.sol:SettlRouter \
  --rpc-url https://rpc.mainnet.arc.io \
  --account settl-deployer \
  --broadcast
```

> Note: the source file is `SettlRouter.sol` and the contract is `SettlRouter`.
> The previously deployed contract was named `ArcTapRouter`; bytecode is identical.

The output prints:
```
Deployed to: 0x<YOUR_MAINNET_ROUTER_ADDRESS>
Transaction hash: 0x<TX_HASH>
```

### Record the deployment

Update `deployments/arc-mainnet.json` with the actual `router`, `txHash`, `block`, and `deployedAt`.

---

## 2. Verify the contract on Arc Explorer

```bash
forge verify-contract \
  0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F \
  contracts/SettlRouter.sol:SettlRouter \
  --chain-id 5042 \
  --rpc-url https://rpc.mainnet.arc.io \
  --watch
```

Then confirm at: `https://explorer.arc.io/address/0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F`

---

## 3. Configure Vercel for mainnet

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_NETWORK` | `mainnet` |
| `VITE_MAINNET_ROUTER_ADDRESS` | `0xaC6ae5A67Ded7804104008B7Ec0F46Dd3472038F` |
| `VITE_PRIVY_APP_ID` | your Privy App ID |
| `VITE_ARC_MAINNET_RPC_URL` | `https://rpc.mainnet.arc.io` (optional, already the default) |
| `VITE_ARC_MAINNET_WS_URL` | `wss://rpc.mainnet.arc.io` (optional, already the default) |
| `VITE_MAX_INVOICE_USDC` | `50` (default on mainnet; adjust when ready) |

Then **redeploy** (Deployments → Redeploy, no cache).

---

## 4. Update Privy allowed domains

In https://console.privy.io → your app → Settings → Allowed domains:
- Add your production domain (e.g. `settl.app` or your Vercel URL)

---

## 5. Smoke test (start with $0.01)

1. Open the live site — the banner should read "Arc Mainnet · real USDC"
2. Set up a merchant address (your Arc mainnet wallet)
3. Create a $0.01 USDC charge and scan the QR from another device
4. Confirm the payment goes through and the PAID screen appears
5. Check the explorer link in history to verify the on-chain transaction
6. Only after a successful $0.01 test, increase `VITE_MAX_INVOICE_USDC` if needed

---

## 6. Update AGENTS.md

After verifying mainnet, update `AGENTS.md` with the mainnet contract address and deployment details.
