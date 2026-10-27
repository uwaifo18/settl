# Mainnet Deploy Guide

> **You must complete every step below yourself.**
> Arc Studio does not deploy to, sign for, or transact on mainnet.

---

## 1. Deploy SettlRouter to Arc Mainnet

### Prerequisites
- Foundry installed (`foundryup`)
- A funded Arc Mainnet wallet (you need USDC for gas — on Arc, USDC IS gas)
- To get mainnet USDC on Arc: bridge from Ethereum/Base via https://bridge.arc.io

### Create an encrypted keystore (never use --private-key)

```bash
cast wallet import settl-deployer --interactive
# Enter your private key when prompted, then set a password
# This creates ~/.foundry/keystores/settl-deployer
```

### Deploy

```bash
cd /path/to/settl

forge build

forge create contracts/ArcTapRouter.sol:ArcTapRouter \
  --rpc-url https://rpc.mainnet.arc.io \
  --account settl-deployer \
  --broadcast
```

The output will print:
```
Deployed to: 0x<YOUR_MAINNET_ROUTER_ADDRESS>
Transaction hash: 0x<TX_HASH>
```

### Record the deployment

Update `deployments/arc-mainnet.json`:
```json
{
  "network": "arc-mainnet",
  "chainId": 5042,
  "contractName": "SettlRouter",
  "address": "0x<YOUR_MAINNET_ROUTER_ADDRESS>",
  "txHash": "0x<TX_HASH>",
  "deployedAt": "<ISO timestamp>"
}
```

---

## 2. Verify the contract on Arc Explorer

```bash
forge verify-contract \
  0x<YOUR_MAINNET_ROUTER_ADDRESS> \
  contracts/ArcTapRouter.sol:ArcTapRouter \
  --chain-id 5042 \
  --rpc-url https://rpc.mainnet.arc.io \
  --watch
```

Then confirm at: `https://explorer.arc.io/address/0x<YOUR_MAINNET_ROUTER_ADDRESS>`

---

## 3. Configure Vercel for mainnet

In your Vercel project → **Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_NETWORK` | `mainnet` |
| `VITE_MAINNET_ROUTER_ADDRESS` | `0x<YOUR_MAINNET_ROUTER_ADDRESS>` |
| `VITE_PRIVY_APP_ID` | your Privy App ID |

Then **redeploy** (Deployments → Redeploy, no cache).

---

## 4. Update Privy allowed domains

In https://console.privy.io → your app → Settings → Allowed domains:
- Add your production domain (e.g. `settl-sable.vercel.app` or your custom domain)

---

## 5. Smoke test

1. Open the live site — the TESTNET banner should be gone
2. Set up a merchant address (your Arc mainnet wallet)
3. Create a 0.01 USDC charge and scan the QR from another device
4. Confirm the payment goes through and the PAID screen appears
5. Check the explorer link in history to verify the on-chain transaction

---

## 6. Update AGENTS.md

After deploy, update `/home/user/app/AGENTS.md` with the mainnet contract address.
