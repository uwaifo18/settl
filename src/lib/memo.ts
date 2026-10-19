/**
 * Arc Memo contract integration.
 * Predeployed at 0x5294E9927c3306DcBaDb03fe70b92e01cCede505 on Arc Testnet.
 * Wraps any contract call and emits a Memo event with arbitrary metadata,
 * preserving the original msg.sender via Arc's CallFrom precompile.
 *
 * Only EOA wallets are supported (MetaMask, Coinbase Wallet, Rabby, etc).
 * Smart contract wallets (ERC-4337) will revert.
 */

import { toHex, encodeAbiParameters, parseAbiParameters } from 'viem'

/** Arc Testnet Memo contract address */
export const MEMO_CONTRACT_ADDRESS = '0x5294E9927c3306DcBaDb03fe70b92e01cCede505' as const

/** Memo contract ABI — only the function and events we use */
export const MEMO_ABI = [
  {
    type: 'function',
    name: 'memo',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'target', type: 'address' },
      { name: 'data', type: 'bytes' },
      { name: 'memoId', type: 'bytes32' },
      { name: 'memoData', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'event',
    name: 'BeforeMemo',
    anonymous: false,
    inputs: [{ name: 'memoIndex', type: 'uint256', indexed: true }],
  },
  {
    type: 'event',
    name: 'Memo',
    anonymous: false,
    inputs: [
      { name: 'sender', type: 'address', indexed: true },
      { name: 'target', type: 'address', indexed: true },
      { name: 'callDataHash', type: 'bytes32', indexed: false },
      { name: 'memoId', type: 'bytes32', indexed: true },
      { name: 'memo', type: 'bytes', indexed: false },
      { name: 'memoIndex', type: 'uint256', indexed: false },
    ],
  },
] as const

/**
 * Encode the memo payload as UTF-8 bytes.
 * We store a compact JSON object so indexers can parse it.
 */
export interface MemoPayload {
  businessName?: string
  note?: string
  invoiceId: string
  amountUsdc: string
}

export function encodeMemoData(payload: MemoPayload): `0x${string}` {
  const json = JSON.stringify({
    app: 'settl',
    ...payload,
  })
  return toHex(new TextEncoder().encode(json))
}

export function decodeMemoData(hexBytes: `0x${string}`): MemoPayload | null {
  try {
    const bytes = hexBytes.startsWith('0x') ? hexBytes.slice(2) : hexBytes
    const text = new TextDecoder().decode(
      new Uint8Array(bytes.match(/.{1,2}/g)!.map(b => parseInt(b, 16)))
    )
    const parsed = JSON.parse(text) as Record<string, unknown>
    return {
      businessName: typeof parsed.businessName === 'string' ? parsed.businessName : undefined,
      note: typeof parsed.note === 'string' ? parsed.note : undefined,
      invoiceId: typeof parsed.invoiceId === 'string' ? parsed.invoiceId : '',
      amountUsdc: typeof parsed.amountUsdc === 'string' ? parsed.amountUsdc : '',
    }
  } catch {
    return null
  }
}

/**
 * Encode ArcTapRouter.pay() calldata for use as the `data` arg to Memo.memo().
 * We encode manually so we don't need to import the full router ABI here.
 */
export function encodePayCalldata(
  invoiceId: `0x${string}`,
  merchant: `0x${string}`,
  amount: bigint,
  deadline: bigint
): `0x${string}` {
  // Function selector for pay(bytes32,address,uint256,uint256)
  // keccak256('pay(bytes32,address,uint256,uint256)') => 0x503b584b
  const selector = '0x503b584b' as `0x${string}`
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, address, uint256, uint256'),
    [invoiceId, merchant, amount, deadline]
  )
  // Concatenate selector + encoded params
  return (selector + encoded.slice(2)) as `0x${string}`
}
