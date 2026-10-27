/**
 * Awaiting payment screen — QR hero, countdown ring, settled-point status dot.
 * Business logic unchanged.
 */

import { useEffect, useState, useRef } from 'react'
import { Copy, Share2, Smartphone, WifiOff } from 'lucide-react'
import { motion } from 'framer-motion'
import QRDisplay from './QRDisplay'
import { formatUsdc, formatAddress } from '@/lib/amount'
import { formatCountdown, secondsUntilDeadline, type Invoice } from '@/lib/invoice'
import { requestWakeLock, releaseWakeLock } from '@/lib/wakelock'

interface Props {
  invoice: Invoice
  payUrl: string
  onCancel: () => void
}

const NFC_SUPPORTED = 'NDEFReader' in window
const TOTAL_SECONDS = 10 * 60 // default invoice duration — used for ring %

export default function MerchantAwaiting({ invoice, payUrl, onCancel }: Props) {
  const [countdown, setCountdown] = useState(secondsUntilDeadline(invoice))
  const [copied, setCopied] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'done' | 'error'>('idle')
  const [nfcError, setNfcError] = useState('')
  const [showCancelSheet, setShowCancelSheet] = useState(false)
  const cancelTriggerRef = useRef<HTMLButtonElement>(null)

  // Wake lock
  useEffect(() => {
    void requestWakeLock()
    return () => releaseWakeLock()
  }, [])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => setCountdown(secondsUntilDeadline(invoice)), 1000)
    return () => clearInterval(interval)
  }, [invoice])

  // Online/offline
  useEffect(() => {
    const on = () => setIsOnline(true)
    const off = () => setIsOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  async function handleCopy() {
    try { await navigator.clipboard.writeText(payUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }

  async function handleShare() {
    if (navigator.share) {
      try { await navigator.share({ title: `Pay ${formatUsdc(invoice.amount)} USDC`, url: payUrl }) }
      catch { void handleCopy() }
    } else { void handleCopy() }
  }

  async function handleNFCWrite() {
    if (!NFC_SUPPORTED) return
    setNfcStatus('writing'); setNfcError('')
    try {
      const NDEFReaderClass = (window as unknown as { NDEFReader: new() => { write(msg: unknown): Promise<void> } }).NDEFReader
      const ndef = new NDEFReaderClass()
      await ndef.write({ records: [{ recordType: 'url', data: payUrl }] })
      setNfcStatus('done')
      setTimeout(() => setNfcStatus('idle'), 3000)
    } catch (err: unknown) {
      setNfcStatus('error')
      setNfcError((err as Error).message ?? 'NFC write failed')
    }
  }

  // Countdown ring
  const ringRadius = 28
  const ringCirc = 2 * Math.PI * ringRadius
  const ringPct = Math.max(0, countdown / TOTAL_SECONDS)
  const isWarning = countdown < 60 && countdown > 0

  return (
    <div className="flex min-h-dvh flex-col safe-top safe-bottom" style={{ background: 'var(--bg)' }}>

      {/* Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold"
          style={{ background: 'var(--danger)', color: '#fff' }}>
          <WifiOff className="h-3.5 w-3.5" />
          Offline — payments can't be detected until you reconnect
        </div>
      )}

      {/* Amount */}
      <div className="px-5 pt-6 text-center">
        <p className="mb-1 text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
          {invoice.name ?? 'Awaiting payment'}
        </p>
        <div className="flex items-baseline justify-center gap-2" aria-live="polite">
          <span className="tabular-nums text-5xl font-extrabold tracking-tight" style={{ color: 'var(--text)', letterSpacing: '-0.04em' }}>
            {formatUsdc(invoice.amount)}
          </span>
          <span className="text-xl font-semibold" style={{ color: 'var(--text-muted)' }}>USDC</span>
        </div>
        {invoice.memo && (
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{invoice.memo}</p>
        )}
      </div>

      {/* QR hero — white card */}
      <div className="flex flex-1 items-center justify-center px-5 py-4">
        <div className="w-full max-w-xs rounded-3xl p-5" style={{ background: '#fff', border: '1px solid var(--border)' }}>
          <QRDisplay url={payUrl} size={240} />
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center justify-center gap-2 pb-3" aria-live="polite">
        <motion.span
          className="h-2 w-2 rounded-full"
          style={{ background: isOnline ? 'var(--paid)' : 'var(--text-muted)' }}
          animate={isOnline ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {isOnline ? 'Waiting for payment…' : 'Offline'}
        </span>
      </div>

      {/* Countdown ring */}
      <div className="flex items-center justify-center gap-3 pb-4">
        <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
          <circle cx="32" cy="32" r={ringRadius} fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="32" cy="32" r={ringRadius}
            fill="none"
            stroke={isWarning ? 'var(--warn)' : 'var(--paid)'}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={ringCirc}
            strokeDashoffset={ringCirc * (1 - ringPct)}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
          />
        </svg>
        <span
          className="mono text-xl font-semibold tabular-nums"
          style={{ color: isWarning ? 'var(--warn)' : 'var(--text-muted)' }}
        >
          {formatCountdown(countdown)}
        </span>
      </div>

      {/* Merchant address */}
      <div className="mx-5 mb-4 rounded-2xl px-4 py-3 text-center" style={{ background: 'var(--surface)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Paying to</p>
        <p className="mono text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {formatAddress(invoice.merchant)}
        </p>
      </div>

      {/* Action row */}
      <div className="flex gap-2 px-5 pb-3">
        <button
          type="button"
          onClick={() => { void handleCopy() }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: '48px' }}
          aria-label="Copy payment link"
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={() => { void handleShare() }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: '48px' }}
          aria-label="Share payment link"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
        {NFC_SUPPORTED && (
          <button
            type="button"
            onClick={() => { void handleNFCWrite() }}
            disabled={nfcStatus === 'writing'}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl py-3.5 text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', minHeight: '48px' }}
          >
            <Smartphone className="h-4 w-4" />
            {nfcStatus === 'writing' ? 'Hold…' : nfcStatus === 'done' ? 'Written!' : 'NFC'}
          </button>
        )}
      </div>

      {nfcStatus === 'error' && (
        <p className="px-5 pb-2 text-center text-xs" style={{ color: 'var(--danger)' }}>
          NFC error: {nfcError}
        </p>
      )}

      {/* Cancel */}
      <div className="pb-8 text-center">
        <button
          ref={cancelTriggerRef}
          type="button"
          onClick={() => setShowCancelSheet(true)}
          className="py-2 text-sm font-medium"
          style={{ color: 'var(--text-muted)', minHeight: '44px' }}
        >
          Cancel
        </button>
      </div>

      {/* Cancel confirmation sheet */}
      {showCancelSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setShowCancelSheet(false)}
        >
          <div
            className="w-full rounded-t-3xl p-6"
            style={{ background: 'var(--surface)' }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-1 text-base font-bold" style={{ color: 'var(--text)' }}>Cancel this invoice?</h2>
            <p className="mb-5 text-sm" style={{ color: 'var(--text-muted)' }}>
              The QR code will stop working. Any payment already sent will still be accepted for {formatCountdown(countdown)}.
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="w-full rounded-2xl py-4 text-base font-bold"
              style={{ background: 'var(--danger)', color: '#fff', minHeight: '56px' }}
            >
              Yes, cancel
            </button>
            <button
              type="button"
              onClick={() => setShowCancelSheet(false)}
              className="mt-3 w-full py-3 text-sm font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              Keep waiting
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
