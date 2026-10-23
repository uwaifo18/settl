/**
 * Charge screen: keypad + memo + Charge button.
 */

import { useState } from 'react'
import { Loader2, MessageSquare } from 'lucide-react'
import Keypad from './Keypad'
import SettlLogo from './SettlLogo'
import { formatUsdc, parseUsdcInput, isLargeAmount, validateUsdcInput } from '@/lib/amount'

interface Props {
  merchantName: string
  onCharge: (amountMicro: bigint, memo: string) => void
  isCreating?: boolean
}

export default function MerchantCharge({ merchantName, onCharge, isCreating }: Props) {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [showMemo, setShowMemo] = useState(false)

  const parsed = parseUsdcInput(amount)
  const validation = validateUsdcInput(amount)
  const isValid = validation === 'ok' && parsed !== null
  const showLargeWarning = parsed !== null && isLargeAmount(parsed)

  function handleCharge() {
    if (!parsed) return
    onCharge(parsed, memo.slice(0, 64))
  }

  const displayAmount = amount || '0.00'

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--bg-gradient)' }}>
      {/* Amount display */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 pt-8">
        <div className="mb-4">
          <SettlLogo size={28} />
        </div>
        <p className="mb-2 text-sm font-medium" style={{ color: 'var(--muted)' }}>
          {merchantName || 'Charge Amount'}
        </p>
        <div className="mb-1 flex items-baseline gap-2" aria-live="polite" aria-label={`Amount: ${displayAmount} USDC`}>
          <span className="display text-6xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.04em' }}>
            {displayAmount}
          </span>
          <span className="display text-2xl font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
        </div>
        {parsed !== null && (
          <p className="text-sm" style={{ color: 'var(--subtle)' }}>
            ${formatUsdc(parsed)} USDC
          </p>
        )}
        {showLargeWarning === true && (
          <div className="mt-2 rounded-xl px-4 py-2 text-xs font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
            Warning: amount exceeds 100 USDC
          </div>
        )}
      </div>

      {/* Memo row */}
      {showMemo ? (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
            <MessageSquare className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--muted)' }} />
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value.slice(0, 64))}
              placeholder="Add a note (optional)"
              maxLength={64}
              className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
              style={{ color: 'var(--ink)' }}
            />
            <span className="text-xs" style={{ color: 'var(--subtle)' }}>{memo.length}/64</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowMemo(true)}
          className="mx-auto mb-2 flex items-center gap-1.5 py-1.5 text-xs font-medium"
          style={{ color: 'var(--subtle)' }}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Add note
        </button>
      )}

      {/* Keypad */}
      <div className="px-2 pb-2">
        <Keypad value={amount} onChange={setAmount} />
      </div>

      {/* Charge button */}
      <div className="px-4 pb-8">
        <button
          type="button"
          onClick={handleCharge}
          disabled={!isValid || isCreating}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)', minHeight: '56px' }}
          aria-label={`Charge ${parsed ? formatUsdc(parsed) : '0.00'} USDC`}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating invoice...
            </>
          ) : (
            `Charge ${parsed ? '$' + formatUsdc(parsed) : '0.00'} USDC`
          )}
        </button>
      </div>
    </div>
  )
}
