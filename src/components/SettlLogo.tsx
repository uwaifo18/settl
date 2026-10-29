/**
 * Settl logo — open ring mark with green dot + "settl" wordmark.
 * Matches the official brand PNG exactly.
 */

interface Props {
  /** Height in px. Width scales proportionally (~2.4:1 ratio). */
  height?: number
  /** 'light' = ink on transparent (default), 'dark' = ivory on transparent */
  variant?: 'light' | 'dark'
  /** Show wordmark alongside mark (default true) */
  wordmark?: boolean
}

export default function SettlLogo({ height = 40, variant = 'light', wordmark = true }: Props) {
  const ink   = variant === 'dark' ? '#F4F1EA' : '#0B0B0C'
  const green = variant === 'dark' ? '#35D49A' : '#14A06B'

  // Ring: center (30,30), radius 22, stroke 6 — bolder at all sizes
  const cx = 30
  const cy = 30
  const r  = 22

  // Gap at upper-right: −60° to −15° (SVG coords, 0° = 3 o'clock)
  const gapStart = -60
  const gapEnd   = -15

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const px = (deg: number) => cx + r * Math.cos(toRad(deg))
  const py = (deg: number) => cy + r * Math.sin(toRad(deg))

  const startX = px(gapEnd)
  const startY = py(gapEnd)
  const endX   = px(gapStart)
  const endY   = py(gapStart)

  // Large arc clockwise from gapEnd all the way around to gapStart
  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`

  // Dot at midpoint of gap — larger for visibility
  const dotAngle = (gapStart + gapEnd) / 2  // −37.5°
  const dotX = px(dotAngle)
  const dotY = py(dotAngle)
  const dotR = 4.5

  // Canvas: mark (60) + gap (14) + wordmark
  const markW  = 60
  const gapW   = wordmark ? 14 : 0
  const wordW  = wordmark ? 96 : 0
  const totalW = markW + gapW + wordW
  const totalH = 60

  const scale = height / totalH

  return (
    <svg
      width={totalW * scale}
      height={height}
      viewBox={`0 0 ${totalW} ${totalH}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Settl"
      role="img"
    >
      {/* Ring mark — heavier stroke */}
      <path
        d={arcPath}
        stroke={ink}
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      {/* Settled-point dot — larger */}
      <circle cx={dotX} cy={dotY} r={dotR} fill={green} />

      {/* Wordmark — extrabold, tighter tracking */}
      {wordmark && (
        <text
          x={markW + gapW}
          y={42}
          fontFamily="'Manrope', system-ui, sans-serif"
          fontSize="34"
          fontWeight="800"
          letterSpacing="-1.8"
          fill={ink}
        >
          settl
        </text>
      )}
    </svg>
  )
}
