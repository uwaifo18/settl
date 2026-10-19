/**
 * Wake Lock management to prevent screen sleep while awaiting payment.
 * Progressive enhancement — silently fails when not supported.
 */

let wakeLock: WakeLockSentinel | null = null

export function requestWakeLock(): void {
  if (!('wakeLock' in navigator)) return
  navigator.wakeLock.request('screen').then(l => {
    wakeLock = l
    document.addEventListener('visibilitychange', reacquireWakeLock, { once: false })
  }).catch(() => {
    // Not granted
  })
}

function reacquireWakeLock() {
  if (document.visibilityState === 'visible' && !wakeLock) {
    navigator.wakeLock.request('screen').then(l => { wakeLock = l }).catch(() => {})
  }
}

export function releaseWakeLock(): void {
  document.removeEventListener('visibilitychange', reacquireWakeLock)
  if (wakeLock) {
    wakeLock.release().catch(() => {})
    wakeLock = null
  }
}
