/**
 * Merchant Setup screen.
 * First-run: enter receiving address, business name, sound/haptics prefs.
 */

import { useState } from 'react'
import { isAddress } from 'viem'
import { Store, ChevronRight, Volume2, Zap, RotateCcw } from 'lucide-react'
import type { MerchantSettings } from '@/lib/merchant-store'

interface Props {
  onSave: (settings: MerchantSettings) => void
  existing?: MerchantSettings | null
}

export default function MerchantSetup({ onSave, existing }: Props) {
  const [address, setAddress] = useState(existing?.address ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [soundEnabled, setSoundEnabled] = useState(existing?.soundEnabled ?? true)
  const [hapticsEnabled, setHapticsEnabled] = useState(existing?.hapticsEnabled ?? true)
  const [addressError, setAddressError] = useState('')

  function handlePaste() {
    navigator.clipboard.readText().then(text => {
      setAddress(text.trim())
      setAddressError('')
    }).catch(() => {})
  }

  function handleSave() {
    const trimmed = address.trim()
    if (!isAddress(trimmed)) {
      setAddressError('Enter a valid Ethereum address (0x...)')
      return
    }
    setAddressError('')
    onSave({
      address: trimmed,
      name: name.slice(0, 32).trim(),
      soundEnabled,
      hapticsEnabled,
    })
  }

  const isValid = isAddress(address.trim())

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8" style={{ background: 'var(--bg-gradient)' }}>
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--accent)' }}>
          <Store className="h-7 w-7 text-white" />
        </div>
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          {existing ? 'Settings' : 'Set up Settl'}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {existing ? 'Update your merchant details' : 'Enter your receiving address to start accepting USDC payments'}
        </p>
      </div>

      {/* Form card */}
      <div
        className="w-full max-w-sm rounded-3xl p-6 shadow-lg"
        style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
      >
        {/* Receiving address */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Receiving Address
          </label>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={e => { setAddress(e.target.value); setAddressError('') }}
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
              className="mono w-full rounded-xl px-4 py-3 pr-20 text-sm outline-none focus:ring-2"
              style={{
                background: 'var(--surface-muted)',
                color: 'var(--ink)',
                border: `1px solid ${addressError ? 'var(--danger)' : 'var(--border)'}`,
              }}
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold"
              style={{ background: 'var(--surface)', color: 'var(--accent)' }}
            >
              Paste
            </button>
          </div>
          {addressError && (
            <p className="mt-1 text-xs" style={{ color: 'var(--danger)' }}>{addressError}</p>
          )}
          <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
            Payments go directly to this address. Never stored on a server.
          </p>
        </div>

        {/* Business name */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Business Name <span style={{ color: 'var(--subtle)' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.slice(0, 32))}
            placeholder="My Store"
            maxLength={32}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
            style={{
              background: 'var(--surface-muted)',
              color: 'var(--ink)',
              border: '1px solid var(--border)',
            }}
          />
          <p className="mt-1 text-right text-xs" style={{ color: 'var(--subtle)' }}>{name.length}/32</p>
        </div>

        {/* Toggles */}
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Payment chime</span>
            </div>
            <button
              type="button"
              onClick={() => setSoundEnabled(v => !v)}
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{ background: soundEnabled ? 'var(--accent)' : 'var(--border)' }}
              role="switch"
              aria-checked={soundEnabled}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: soundEnabled ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: 'var(--muted)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Haptic buzz</span>
            </div>
            <button
              type="button"
              onClick={() => setHapticsEnabled(v => !v)}
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{ background: hapticsEnabled ? 'var(--accent)' : 'var(--border)' }}
              role="switch"
              aria-checked={hapticsEnabled}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: hapticsEnabled ? 'translateX(20px)' : 'translateX(2px)' }}
              />
            </button>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: 'var(--accent)' }}
        >
          {existing ? 'Save Changes' : 'Start Accepting Payments'}
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Reset option */}
        {existing && (
          <button
            type="button"
            onClick={() => onSave({ ...existing, address: '' as `0x${string}` })}
            className="mt-3 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
            style={{ color: 'var(--danger)' }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset all settings
          </button>
        )}
      </div>

      {/* Testnet banner */}
      <div className="mt-6 rounded-xl px-4 py-2 text-center text-xs font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
        TESTNET — no real funds
      </div>
    </div>
  )
}
