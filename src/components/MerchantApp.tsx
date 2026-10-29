/**
 * Merchant App orchestrator.
 * Manages state machine: setup → charge → awaiting → paid/expired/cancelled → history
 */

import { useState, useEffect, useCallback } from 'react'
import { Settings, History } from 'lucide-react'
import MerchantSetup from './MerchantSetup'
import MerchantCharge from './MerchantCharge'
import MerchantAwaiting from './MerchantAwaiting'
import MerchantPaid from './MerchantPaid'
import MerchantHistory from './MerchantHistory'
import { createInvoice, type Invoice } from '@/lib/invoice'
import { buildPayUrl } from '@/lib/invoice'
import { startWatcher, checkIsPaid, type Watcher, type PaidLog } from '@/lib/watcher'
import { loadMerchantSettings, saveMerchantSettings, clearMerchantSettings, type MerchantSettings } from '@/lib/merchant-store'
import { saveHistoryEntry, updateHistoryEntry } from '@/lib/history'
import { celebratePayment, unlockAudio } from '@/lib/audio'
import { ROUTER_ADDRESS, activeChain, CONFIG_ERROR } from '@/network'

// Base URL for pay links
function getBaseUrl(): string {
  return window.location.origin
}

type AppScreen = 'setup' | 'charge' | 'awaiting' | 'paid' | 'history'

interface PaidState {
  log: PaidLog
  detectedMs?: number
}

/** Full-screen configuration error — shown when mainnet router is misconfigured. */
function ConfigError({ message }: { message: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center" style={{ background: 'var(--bg)' }}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'rgba(248,113,113,0.1)' }}>
        <Settings className="h-7 w-7" style={{ color: 'var(--danger)' }} />
      </div>
      <h1 className="mb-2 text-xl font-bold" style={{ color: 'var(--text)' }}>Settl is misconfigured</h1>
      <p className="mb-2 max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>Payments are disabled.</p>
      <p className="max-w-xs rounded-xl px-4 py-3 text-xs font-mono" style={{ background: 'var(--surface)', color: 'var(--danger)', wordBreak: 'break-all' }}>{message}</p>
    </div>
  )
}

/** Inner component — only rendered when CONFIG_ERROR is null, so hooks are always called. */
function MerchantAppInner() {
  // Load settings synchronously (localStorage is sync)
  const [settings, setSettings] = useState<MerchantSettings | null>(() => loadMerchantSettings())
  const [screen, setScreen] = useState<AppScreen>(() => {
    const s = loadMerchantSettings()
    return !s || !s.address ? 'setup' : 'charge'
  })
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payUrl, setPayUrl] = useState('')
  const [paidState, setPaidState] = useState<PaidState | null>(null)
  const [watcher, setWatcher] = useState<Watcher | null>(null)

  // Stop watcher on unmount
  useEffect(() => {
    return () => { watcher?.stop() }
  }, [watcher])

  const handleSaveSettings = useCallback((newSettings: MerchantSettings) => {
    if (!newSettings.address) {
      clearMerchantSettings()
      setSettings(null)
      setScreen('setup')
      return
    }
    saveMerchantSettings(newSettings)
    setSettings(newSettings)
    setScreen('charge')
  }, [])

  const handleCharge = useCallback((amountMicro: bigint, memo: string) => {
    const charge = async () => {
    if (!settings) return

    const newInvoice = createInvoice({
      merchant: settings.address,
      amount: amountMicro,
      routerAddress: ROUTER_ADDRESS,
      name: settings.name,
      memo: memo || undefined,
    })

    // Record block number for accurate backfill.
    // Retry up to 3 times so a transient RPC hiccup doesn't leave createdBlock undefined.
    // A missing createdBlock forces the watcher to scan from (latest - 3600) blocks,
    // which covers ~1 hour of Arc blocks and is safe but slower.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { createPublicClient, http } = await import('viem')
        const client = createPublicClient({ chain: activeChain, transport: http() })
        newInvoice.createdBlock = await client.getBlockNumber()
        break
      } catch {
        if (attempt < 2) await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
      }
    }

    const url = buildPayUrl(getBaseUrl(), newInvoice)
    setInvoice(newInvoice)
    setPayUrl(url)
    setPaidState(null)

    // Save to history as awaiting
    await saveHistoryEntry({
      invoice: newInvoice,
      status: 'awaiting',
      createdAt: Date.now(),
    })

    // Start watcher
    watcher?.stop()
    const newWatcher = startWatcher({
      routerAddress: ROUTER_ADDRESS,
      invoice: newInvoice,
      onPaid: (log) => {
        void (async () => {
          newWatcher.stop()

          // Cross-check isPaid onchain
          const confirmed = await checkIsPaid(ROUTER_ADDRESS, newInvoice.merchant, newInvoice.invoiceId)
          if (!confirmed) return

          const detectedMs = undefined

          setPaidState({ log, detectedMs })
          setScreen('paid')

          // Celebrate — celebratePayment handles both chime + haptics
          if (settings?.soundEnabled || settings?.hapticsEnabled) {
            celebratePayment()
          }

          // Update history — include onchain memo if the Arc Memo event was captured
          await updateHistoryEntry(newInvoice.invoiceId, {
            status: log.amount >= newInvoice.amount ? 'paid' : 'underpaid',
            paidAmount: log.amount,
            payerAddress: log.payer,
            txHash: log.txHash,
            settledAt: Date.now(),
            detectedMs,
            onchainMemo: log.onchainMemo,
          })
        })()
      },
      onError: (err) => {
        console.warn('[MerchantApp] watcher error:', err)
      },
    })
    setWatcher(newWatcher)
    setScreen('awaiting')
    }
    void charge()
  }, [settings, watcher]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = useCallback(() => {
    watcher?.stop()
    setWatcher(null)
    if (invoice) {
      void updateHistoryEntry(invoice.invoiceId, { status: 'cancelled' })
    }
    setInvoice(null)
    setPayUrl('')
    setScreen('charge')
  }, [watcher, invoice])

  const handleNewCharge = useCallback(() => {
    watcher?.stop()
    setWatcher(null)
    setInvoice(null)
    setPayUrl('')
    setPaidState(null)
    setScreen('charge')
  }, [watcher])

  // Check expiry while on awaiting screen
  useEffect(() => {
    if (screen !== 'awaiting' || !invoice) return
    const check = setInterval(() => {
      const now = Math.floor(Date.now() / 1000)
      if (now > invoice.deadline) {
        clearInterval(check)
        watcher?.stop()
        setWatcher(null)
        void updateHistoryEntry(invoice.invoiceId, { status: 'expired' })
        setScreen('charge')
        setInvoice(null)
        setPayUrl('')
      }
    }, 1000)
    return () => clearInterval(check)
  }, [screen, invoice, watcher])

  if (screen === 'setup') {
    return (
      <div onClick={unlockAudio}>
        <MerchantSetup existing={settings} onSave={handleSaveSettings} />
      </div>
    )
  }

  if (screen === 'history') {
    return (
      <div onClick={unlockAudio}>
        <MerchantHistory onBack={() => setScreen('charge')} />
      </div>
    )
  }

  return (
    <div className="relative" onClick={unlockAudio}>
      {/* Toolbar icons — positioned inside the header row */}
      <div className="absolute right-4 top-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setScreen('history')}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline, #1E1E21)' }}
          aria-label="View payment history"
        >
          <History className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </button>
        <button
          type="button"
          onClick={() => setScreen('setup')}
          className="flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--surface)', border: '1px solid var(--hairline, #1E1E21)' }}
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {screen === 'charge' && (
        <MerchantCharge
          merchantName={settings?.name ?? ''}
          onCharge={handleCharge}
        />
      )}

      {screen === 'awaiting' && invoice && (
        <MerchantAwaiting
          invoice={invoice}
          payUrl={payUrl}
          onCancel={handleCancel}
        />
      )}

      {screen === 'paid' && invoice && paidState && (
        <MerchantPaid
          invoice={invoice}
          paidLog={paidState.log}
          detectedMs={paidState.detectedMs}
          onNewCharge={handleNewCharge}
        />
      )}
    </div>
  )
}

/** Outer wrapper — guards against misconfiguration before mounting hooks. */
export default function MerchantApp() {
  if (CONFIG_ERROR) return <ConfigError message={CONFIG_ERROR} />
  return <MerchantAppInner />
}
