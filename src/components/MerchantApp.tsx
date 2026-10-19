/**
 * Merchant App orchestrator.
 * Manages state machine: setup → charge → awaiting → paid/expired/cancelled → history
 */

import { useState, useEffect, useCallback } from 'react'
import { Settings, History } from 'lucide-react'
import TestnetBanner from './TestnetBanner'
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
import { celebratePayment, playPaymentChime } from '@/lib/audio'

const ROUTER_ADDRESS = (import.meta.env.VITE_ROUTER_ADDRESS ?? '') as `0x${string}`

// Base URL for pay links
function getBaseUrl(): string {
  return window.location.origin
}

type AppScreen = 'setup' | 'charge' | 'awaiting' | 'paid' | 'history'

interface PaidState {
  log: PaidLog
  detectedMs?: number
}

export default function MerchantApp() {
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

    // Record block number for backfill
    try {
      const { createPublicClient, http } = await import('viem')
      const { arcTestnet } = await import('viem/chains')
      const client = createPublicClient({ chain: arcTestnet, transport: http() })
      const blockNumber = await client.getBlockNumber()
      newInvoice.createdBlock = blockNumber
    } catch {
      // Non-blocking
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

          // Celebrate
          if (settings?.soundEnabled) playPaymentChime()
          if (settings?.hapticsEnabled) {
            try { navigator.vibrate?.([100, 50, 100]) } catch { /* ignore */ }
          }
          if (settings?.soundEnabled && settings?.hapticsEnabled) celebratePayment()

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
      <div>
        <TestnetBanner />
        <MerchantSetup existing={settings} onSave={handleSaveSettings} />
      </div>
    )
  }

  if (screen === 'history') {
    return (
      <div>
        <TestnetBanner />
        <MerchantHistory onBack={() => setScreen('charge')} />
      </div>
    )
  }

  return (
    <div className="relative">
      <TestnetBanner />
      {/* Toolbar icons */}
      <div className="absolute right-4 top-10 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => setScreen('history')}
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          aria-label="View payment history"
        >
          <History className="h-5 w-5" style={{ color: 'var(--ink-2)' }} />
        </button>
        <button
          type="button"
          onClick={() => setScreen('setup')}
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          aria-label="Open settings"
        >
          <Settings className="h-5 w-5" style={{ color: 'var(--ink-2)' }} />
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
