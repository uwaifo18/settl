/**
 * Charge screen — landing-matched dark minimal aesthetic.
 * Business logic unchanged.
 */

import { useState } from 'react'
import { MessageSquare, X } from 'lucide-react'
import Keypad from './Keypad'
import SettlLogo from './SettlLogo'
import { formatUsdc, parseUsdcInput, isLargeAmount, validateUsdcInput } from '@/lib/amount'
import { MAX_INVOICE_USDC, CHAIN_LABEL } from '@/network'

interface Props {
  merchantName: string
  onCharge: (amountMicro: bigint, memo: string) => void
  isCreating?: boolean
}

export default function MerchantCharge({ merchantName, onCharge, isCreating }: Props) {
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [showMemo, setShowMemo] = useState(false)
  const [showLargeSheet, setShowLargeSheet] = useState(false)

  const parsed = parseUsdcInput(amount)
  const validation = validateUsdcInput(amount)
  const isCapped = parsed !== null && parsed > MAX_INVOICE_USDC
  const isValid = validation === 'ok' && parsed !== null && !isCapped
  const isLarge = parsed !== null && isLargeAmount(parsed)

  function handleCharge() {
    if (!parsed) return
    if (isLarge && !showLargeSheet) { setShowLargeSheet(true); return }
    setShowLargeSheet(false)
    onCharge(parsed, memo.slice(0, 64))
  }

  const displayAmount = amount || '0'

  return (
    <div
      className="flex min-h-dvh flex-col safe-top safe-bottom"
      style={{ background: 'var(--bg)' }}
    >
      {/* Header — matches landing nav height and weight */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--hairline, #1E1E21)' }}
      >
        <SettlLogo height={36} variant="auto" href="/" />
        {merchantName ? (
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            {merchantName}
          </span>
        ) : null}
        <div style={{ width: 56 }} />
      </div>

      {/* Amount card */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-6">
        <div
          className="w-full max-w-xs rounded-3xl p-6 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          {/* CHARGE label */}
          <p
            className="mb-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'var(--text-muted)' }}
          >
            Charge
          </p>

          {/* Amount */}
          <div
            className="flex items-baseline justify-center gap-2"
            aria-live="polite"
            aria-label={`Amount: ${displayAmount} USDC`}
          >
            <span
              className="tabular-nums font-extrabold leading-none"
              style={{
                color: 'var(--text)',
                fontSize: displayAmount.length > 6 ? '2.8rem' : displayAmount.length > 4 ? '3.5rem' : '4.5rem',
                letterSpacing: '-0.04em',
              }}
            >
              {displayAmount}
            </span>
            <span
              className="text-xl font-semibold"
              style={{ color: 'var(--paid)' }}
            >
              USDC
            </span>
          </div>

          {/* Status dot row */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full transition-colors duration-300"
              style={{ background: isValid ? 'var(--paid)' : 'var(--border)' }}
            />
            {isCapped && (
              <span className="text-xs font-semibold" style={{ color: 'var(--danger)' }}>
                Exceeds the {(Number(MAX_INVOICE_USDC) / 1_000_000).toFixed(0)} USDC cap on {CHAIN_LABEL}
              </span>
            )}
            {!isCapped && isLarge && (
              <span className="text-xs font-semibold" style={{ color: 'var(--warn)' }}>
                Over 100 USDC
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Memo row */}
      <div className="px-5 pb-3">
        {showMemo ? (
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value.slice(0, 64))}
              placeholder="Add a note (optional)"
              maxLength={64}
              autoFocus
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text)' }}
            />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{memo.length}/64</span>
            <button
              type="button"
              onClick={() => { setShowMemo(false); setMemo('') }}
              className="p-1"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Remove note"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowMemo(true)}
            className="flex items-center gap-1.5 py-2 text-xs font-medium"
            style={{ color: 'var(--text-muted)', minHeight: '40px' }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Add note
          </button>
        )}
      </div>

      {/* Keypad */}
      <div className="px-3 pb-3">
        <Keypad value={amount} onChange={setAmount} />
      </div>

      {/* Charge button */}
      <div className="px-5 pb-8">
        <button
          type="button"
          onClick={handleCharge}
          disabled={!isValid || isCreating === true}
          className="w-full rounded-2xl py-4 text-base font-bold text-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: 'var(--paid)', minHeight: '56px' }}
          aria-label={`Charge ${parsed ? formatUsdc(parsed) : '0.00'} USDC`}
        >
          {isCreating === true ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
              Creating…
            </span>
          ) : (
            `Charge ${parsed ? formatUsdc(parsed) : '0.00'} USDC`
          )}
        </button>
      </div>

      {/* Large-amount bottom sheet */}
      {showLargeSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => setShowLargeSheet(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: 'var(--warn)' }} />
              <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>Large amount</h2>
            </div>
            <p className="mb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
              You are about to charge {parsed ? formatUsdc(parsed) : ''} USDC.
              This is over 100 USDC — confirm before proceeding.
            </p>
            <button
              type="button"
              onClick={handleCharge}
              className="w-full rounded-2xl py-4 text-base font-bold text-black"
              style={{ background: 'var(--paid)', minHeight: '56px' }}
            >
              Confirm charge
            </button>
            <button
              type="button"
              onClick={() => setShowLargeSheet(false)}
              className="mt-3 w-full py-3 text-sm font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
