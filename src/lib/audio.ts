/**
 * Audio + haptics for payment confirmation.
 * Plays a chime and triggers navigator.vibrate on PAID.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioCtx
}

/**
 * Call this on any user gesture (tap, click) to unlock the AudioContext.
 * Browsers suspend AudioContext until a gesture has occurred.
 * Call once when the app loads and the user first taps anything.
 */
export function unlockAudio(): void {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
  } catch {
    // ignore
  }
}

/** Play a short pleasant chime (C5 + E5 chord, 400ms) */
export function playPaymentChime(): void {
  try {
    const ctx = getAudioContext()
    const notes = [523.25, 659.25, 783.99] // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.value = freq

      const startTime = ctx.currentTime + i * 0.05
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4)

      osc.start(startTime)
      osc.stop(startTime + 0.45)
    })
  } catch {
    // Audio not available — silent fail
  }
}

/** Trigger vibration pattern if supported */
export function vibrate(): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100])
    }
  } catch {
    // Haptics not available
  }
}

/** Play chime + vibrate together */
export function celebratePayment(): void {
  playPaymentChime()
  vibrate()
}
