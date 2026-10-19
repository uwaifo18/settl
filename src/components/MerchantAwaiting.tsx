/**
 * Awaiting payment screen: QR code, countdown, NFC write, copy/share.
 * Holds Wake Lock while visible.
 */

import { useEffect, useState } from 'react'
import { Copy, Share2, X, Wifi, WifiOff, Smartphone } from 'lucide-react'
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

// Feature-detect NFC
const NFC_SUPPORTED = 'NDEFReader' in window

export default function MerchantAwaiting({ invoice, payUrl, onCancel }: Props) {
  const [countdown, setCountdown] = useState(secondsUntilDeadline(invoice))
  const [copied, setCopied] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'writing' | 'done' | 'error'>('idle')
  const [nfcError, setNfcError] = useState('')

  // Wake lock
  useEffect(() => {
    void requestWakeLock()
    return () => releaseWakeLock()
  }, [])

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(secondsUntilDeadline(invoice))
    }, 1000)
    return () => clearInterval(interval)
  }, [invoice])

  // Online/offline detection
  useEffect(() => {
    const onOnline = () => setIsOnline(true)
    const onOffline = () => setIsOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(payUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Ignore
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Pay ${invoice.name ?? 'merchant'} ${formatUsdc(invoice.amount)} USDC`,
          url: payUrl,
        })
      } catch {
        // User cancelled or not supported
        void handleCopy()
      }
    } else {
      void handleCopy()
    }
  }

  async function handleNFCWrite() {
    if (!NFC_SUPPORTED) return
    setNfcStatus('writing')
    setNfcError('')
    try {
      // NDEFReader is not in standard TS lib — access via window
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

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-6" style={{ background: 'var(--bg-gradient)' }}>
      {/* Offline banner */}
      {!isOnline && (
        <div className="mb-4 flex w-full max-w-sm items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>
          <WifiOff className="h-4 w-4" />
          Offline. Payments can&apos;t be detected until you reconnect.
        </div>
      )}

      {/* Amount */}
      <div className="mb-4 text-center">
        <p className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
          {invoice.name ?? 'Awaiting payment'}
        </p>
        <div className="flex items-baseline gap-1.5">
          <span className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
            {formatUsdc(invoice.amount)}
          </span>
          <span className="display text-xl font-semibold" style={{ color: 'var(--muted)' }}>USDC</span>
        </div>
        {invoice.memo && (
          <p className="mt-1 text-sm" style={{ color: 'var(--subtle)' }}>{invoice.memo}</p>
        )}
      </div>

      {/* QR Code */}
      <div className="mb-4">
        <QRDisplay url={payUrl} size={220} />
      </div>

      {/* Pulsing indicator */}
      <div className="mb-4 flex items-center gap-2" aria-live="polite">
        <motion.div
          className="h-2 w-2 rounded-full"
          style={{ background: 'var(--accent)' }}
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-sm font-medium" style={{ color: 'var(--muted)' }}>
          {isOnline ? 'Waiting for payment…' : 'Offline — waiting to reconnect'}
        </span>
        {isOnline && <Wifi className="h-4 w-4" style={{ color: 'var(--subtle)' }} />}
      </div>

      {/* Countdown */}
      <div className="mb-4 text-center">
        <span className="mono text-sm" style={{ color: countdown < 60 ? 'var(--danger)' : 'var(--subtle)' }}>
          Expires in {formatCountdown(countdown)}
        </span>
      </div>

      {/* Merchant address */}
      <div className="mb-4 rounded-xl px-4 py-2 text-center" style={{ background: 'var(--surface-muted)' }}>
        <p className="text-xs" style={{ color: 'var(--subtle)' }}>Paying to</p>
        <p className="mono text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>
          {formatAddress(invoice.merchant)}
        </p>
      </div>

      {/* Action row */}
      <div className="mb-4 flex w-full max-w-sm gap-2">
        <button
          type="button"
          onClick={() => { void handleCopy() }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          aria-label="Copy payment link"
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy link'}
        </button>
        <button
          type="button"
          onClick={() => { void handleShare() }}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          aria-label="Share payment link"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>

      {/* NFC — Android Chrome only, hidden elsewhere */}
      {NFC_SUPPORTED && (
        <div className="mb-4 w-full max-w-sm">
          <button
            type="button"
            onClick={() => { void handleNFCWrite() }}
            disabled={nfcStatus === 'writing'}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}
          >
            <Smartphone className="h-4 w-4" />
            {nfcStatus === 'writing' ? 'Hold NFC tag nearby…' :
             nfcStatus === 'done' ? 'Tag written!' :
             'Write to NFC tag'}
          </button>
          {nfcStatus === 'error' && (
            <p className="mt-1 text-center text-xs" style={{ color: 'var(--danger)' }}>
              NFC error: {nfcError}. Try again or use the QR code.
            </p>
          )}
          <p className="mt-1 text-center text-xs" style={{ color: 'var(--subtle)' }}>
            Tap an NFC tag to let customers open this payment by tapping their phone.
          </p>
        </div>
      )}

      {/* Cancel */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 py-2 text-sm font-medium"
        style={{ color: 'var(--subtle)' }}
        aria-label="Cancel payment"
      >
        <X className="h-4 w-4" />
        Cancel
      </button>
    </div>
  )
}
