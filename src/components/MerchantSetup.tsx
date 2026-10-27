/**
 * Merchant Setup — premium redesign.
 * Calm single-column card, checksummed address preview, passkey wallet section.
 * Business logic unchanged.
 */

import { useState } from 'react'
import { isAddress, getAddress } from 'viem'
import { Volume2, Zap, RotateCcw, Fingerprint, LogIn, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import SettlLogo from './SettlLogo'
import type { MerchantSettings } from '@/lib/merchant-store'
import { registerPasskeyWallet, loginPasskeyWallet, isCircleConfigured } from '@/lib/passkey-wallet'

interface Props {
  onSave: (settings: MerchantSettings) => void
  existing?: MerchantSettings | null
}

/** Group a hex address into readable 4-char chunks */
function groupAddress(addr: string): string {
  const body = addr.slice(2)
  const chunks: string[] = []
  for (let i = 0; i < body.length; i += 4) chunks.push(body.slice(i, i + 4))
  return '0x ' + chunks.join(' ')
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className="relative h-7 w-12 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        background: on ? 'var(--paid)' : 'var(--border)',
      }}
    >
      <span
        className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(4px)' }}
      />
    </button>
  )
}

export default function MerchantSetup({ onSave, existing }: Props) {
  const [address, setAddress] = useState(existing?.address ?? '')
  const [name, setName] = useState(existing?.name ?? '')
  const [soundEnabled, setSoundEnabled] = useState(existing?.soundEnabled ?? true)
  const [hapticsEnabled, setHapticsEnabled] = useState(existing?.hapticsEnabled ?? true)
  const [addressError, setAddressError] = useState('')
  const [passkeyLoading, setPasskeyLoading] = useState<'register' | 'login' | null>(null)
  const [passkeyError, setPasskeyError] = useState('')

  const trimmed = address.trim()
  const isValid = isAddress(trimmed)
  let checksummed = ''
  try { checksummed = isValid ? getAddress(trimmed) : '' } catch { /* ignore */ }

  async function handleCreateCircleWallet() {
    setPasskeyError('')
    setPasskeyLoading('register')
    try {
      const addr = await registerPasskeyWallet(name || 'settl-merchant')
      setAddress(addr)
      setAddressError('')
    } catch (err) {
      const msg = (err as Error)?.message ?? ''
      if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancelled')) setPasskeyError('Passkey cancelled.')
      else if (msg.includes('InvalidStateError')) setPasskeyError('Passkey already registered — use "Sign in" instead.')
      else if (msg.includes('not configured')) setPasskeyError('Circle Client Key not set up yet.')
      else setPasskeyError('Could not create wallet. Try again.')
    } finally { setPasskeyLoading(null) }
  }

  async function handleLoginCircleWallet() {
    setPasskeyError('')
    setPasskeyLoading('login')
    try {
      const addr = await loginPasskeyWallet()
      setAddress(addr)
      setAddressError('')
    } catch (err) {
      const msg = (err as Error)?.message ?? ''
      if (msg.includes('NotAllowedError') || msg.toLowerCase().includes('cancelled')) setPasskeyError('Passkey cancelled.')
      else if (msg.includes('not configured')) setPasskeyError('Circle Client Key not set up yet.')
      else setPasskeyError('Could not sign in. Try again.')
    } finally { setPasskeyLoading(null) }
  }

  function handlePaste() {
    navigator.clipboard.readText().then(text => {
      setAddress(text.trim())
      setAddressError('')
    }).catch(() => {})
  }

  function handleSave() {
    if (!isAddress(trimmed)) { setAddressError('Enter a valid Ethereum address (0x…)'); return }
    setAddressError('')
    onSave({ address: trimmed, name: name.slice(0, 32).trim(), soundEnabled, hapticsEnabled })
  }

  const addrState: 'idle' | 'valid' | 'invalid' =
    trimmed === '' ? 'idle' : isValid ? 'valid' : 'invalid'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10 safe-top safe-bottom" style={{ background: 'var(--bg)' }}>

      {/* Logo */}
      <div className="mb-8">
        <SettlLogo height={36} />
      </div>

      {/* Card */}
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.03em' }}>
          {existing ? 'Settings' : 'Set up Settl'}
        </h1>
        <p className="mb-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          {existing ? 'Update your merchant details.' : 'Enter your receiving address to start accepting USDC.'}
        </p>

        {/* Circle passkey wallet */}
        {isCircleConfigured() && (
          <div className="mb-6 rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Circle Wallet
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { void handleCreateCircleWallet() }}
                disabled={passkeyLoading !== null}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--text)', minHeight: '48px' }}
              >
                {passkeyLoading === 'register'
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  : <Fingerprint className="h-4 w-4" />}
                Create wallet
              </button>
              <button
                type="button"
                onClick={() => { void handleLoginCircleWallet() }}
                disabled={passkeyLoading !== null}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                style={{ background: 'var(--surface-raised)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}
              >
                {passkeyLoading === 'login'
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : <LogIn className="h-4 w-4" />}
                Sign in
              </button>
            </div>
            <AnimatePresence>
              {passkeyError && (
                <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
                  <AlertCircle className="h-3.5 w-3.5" />{passkeyError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Receiving address */}
        <div className="mb-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Receiving Address
          </label>
          <div className="relative">
            <input
              type="text"
              value={address}
              onChange={e => { setAddress(e.target.value); setAddressError('') }}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
              className="mono w-full rounded-xl px-4 py-3.5 pr-20 text-sm outline-none transition-all"
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: `1px solid ${addressError ? 'var(--danger)' : addrState === 'valid' ? 'var(--paid)' : 'var(--border)'}`,
                minHeight: '48px',
              }}
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all active:scale-95"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-muted)' }}
            >
              Paste
            </button>
          </div>

          {/* Validation state */}
          <AnimatePresence mode="wait">
            {addressError ? (
              <motion.p key="err" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
                <XCircle className="h-3.5 w-3.5" />{addressError}
              </motion.p>
            ) : addrState === 'valid' ? (
              <motion.div key="valid" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-2">
                <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--paid)' }}>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Valid address
                </div>
                <p className="mono mt-1 break-all text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {groupAddress(checksummed)}
                </p>
              </motion.div>
            ) : addrState === 'invalid' ? (
              <motion.p key="inv" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--danger)' }}>
                <XCircle className="h-3.5 w-3.5" />Not a valid Ethereum address
              </motion.p>
            ) : (
              <p key="idle" className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Payments go directly to this address. Settl never holds your keys.
              </p>
            )}
          </AnimatePresence>
        </div>

        {/* Business name */}
        <div className="mb-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Business Name <span className="normal-case" style={{ color: 'var(--text-muted)' }}>(optional)</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value.slice(0, 32))}
            placeholder="My Store"
            maxLength={32}
            className="w-full rounded-xl px-4 py-3.5 text-sm outline-none transition-all"
            style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', minHeight: '48px' }}
          />
          <p className="mt-1 text-right text-xs" style={{ color: 'var(--text-muted)' }}>{name.length}/32</p>
        </div>

        {/* Toggles */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Payment chime</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Plays on PAID</p>
              </div>
            </div>
            <Toggle on={soundEnabled} onToggle={() => setSoundEnabled(v => !v)} label="Toggle payment chime" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Haptic buzz</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Vibrates on PAID</p>
              </div>
            </div>
            <Toggle on={hapticsEnabled} onToggle={() => setHapticsEnabled(v => !v)} label="Toggle haptic feedback" />
          </div>
        </div>

        {/* Primary action */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!isValid}
          className="w-full rounded-2xl py-4 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: 'var(--text)', minHeight: '56px' }}
        >
          {existing ? 'Save changes' : 'This is my address'}
        </button>

        {/* Reset */}
        {existing && (
          <button
            type="button"
            onClick={() => onSave({ ...existing, address: '' as `0x${string}` })}
            className="mt-4 flex w-full items-center justify-center gap-1.5 py-2 text-xs"
            style={{ color: 'var(--danger)' }}
          >
            <RotateCcw className="h-3 w-3" />
            Reset all settings
          </button>
        )}
      </div>

      {/* Testnet notice */}
      <p className="mt-8 text-xs" style={{ color: 'var(--text-muted)' }}>
        TESTNET — no real funds
      </p>
    </div>
  )
}
