/**
 * Audio + haptics for payment confirmation.
 * Premium chime: three-note ascending arpeggio with a warm sine+triangle blend,
 * soft attack, natural decay, and a short convolution reverb tail.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
  }
  return audioCtx
}

/**
 * Call on any user gesture to unlock the AudioContext.
 * Browsers suspend it until a gesture has occurred.
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

/** Build a short impulse response for a warm room reverb */
function createReverb(ctx: AudioContext): ConvolverNode {
  const convolver = ctx.createConvolver()
  const sampleRate = ctx.sampleRate
  const length = sampleRate * 0.8 // 0.8 s tail
  const buffer = ctx.createBuffer(2, length, sampleRate)
  for (let c = 0; c < 2; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < length; i++) {
      // Exponential decay of white noise
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
    }
  }
  convolver.buffer = buffer
  return convolver
}

/**
 * Premium payment chime.
 * Three-note ascending arpeggio: E5 → G#5 → B5 (major triad, root position).
 * Each note is a blend of sine (fundamental) + triangle (soft harmonics).
 * Routes through a short reverb for warmth.
 */
export function playPaymentChime(): void {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') return

    // Reverb send
    const reverb = createReverb(ctx)
    const reverbGain = ctx.createGain()
    reverbGain.gain.value = 0.22
    reverb.connect(reverbGain)
    reverbGain.connect(ctx.destination)

    // Master output
    const master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)
    master.connect(reverb)

    // Notes: E5, G#5, B5 — ascending major triad
    const notes = [659.25, 830.61, 987.77]
    const noteSpacing = 0.11 // seconds between each note
    const noteVolumes = [0.22, 0.20, 0.28] // B5 slightly louder as the peak

    notes.forEach((freq, i) => {
      const startTime = ctx.currentTime + i * noteSpacing

      // Sine oscillator — fundamental body
      const sine = ctx.createOscillator()
      const sineGain = ctx.createGain()
      sine.type = 'sine'
      sine.frequency.value = freq
      sine.connect(sineGain)
      sineGain.connect(master)

      // Triangle oscillator — soft upper harmonics
      const tri = ctx.createOscillator()
      const triGain = ctx.createGain()
      tri.type = 'triangle'
      tri.frequency.value = freq
      tri.connect(triGain)
      triGain.connect(master)

      const vol = noteVolumes[i] ?? 0.2
      const triVol = vol * 0.35

      // Envelope: fast attack, natural exponential decay
      sineGain.gain.setValueAtTime(0, startTime)
      sineGain.gain.linearRampToValueAtTime(vol, startTime + 0.012)
      sineGain.gain.setValueAtTime(vol, startTime + 0.012)
      sineGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.65)

      triGain.gain.setValueAtTime(0, startTime)
      triGain.gain.linearRampToValueAtTime(triVol, startTime + 0.012)
      triGain.gain.setValueAtTime(triVol, startTime + 0.012)
      triGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.50)

      sine.start(startTime)
      sine.stop(startTime + 0.7)
      tri.start(startTime)
      tri.stop(startTime + 0.55)
    })

    // Final sustain: hold the triad chord softly for a moment
    notes.forEach((freq, i) => {
      const chordStart = ctx.currentTime + notes.length * noteSpacing + 0.04
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(g)
      g.connect(master)

      const vol = (noteVolumes[i] ?? 0.2) * 0.55
      g.gain.setValueAtTime(0, chordStart)
      g.gain.linearRampToValueAtTime(vol, chordStart + 0.04)
      g.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.9)

      osc.start(chordStart)
      osc.stop(chordStart + 0.95)
    })
  } catch {
    // Audio not available — silent fail
  }
}

/** Trigger a satisfying double-pulse vibration if supported */
export function vibrate(): void {
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([80, 40, 120]) // short + longer pulse
    }
  } catch {
    // Haptics not available
  }
}

/** Play chime + vibrate together on payment confirmation */
export function celebratePayment(): void {
  playPaymentChime()
  vibrate()
}
