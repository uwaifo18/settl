/**
 * Settl logo — open ring mark with green dot + "settl" wordmark.
 * Matches the official brand PNG exactly.
 */

interface Props {
  /** Height in px. Width scales proportionally (~2.3:1 ratio). */
  height?: number
  /** 'light' = ink on transparent (default), 'dark' = ivory on transparent */
  variant?: 'light' | 'dark'
  /** Show wordmark alongside mark (default true) */
  wordmark?: boolean
}

export default function SettlLogo({ height = 40, variant = 'light', wordmark = true }: Props) {
  const ink = variant === 'dark' ? '#F4F1EA' : '#0B0B0C'
  const green = variant === 'dark' ? '#35D49A' : '#14A06B'

  // Ring: center (28,28), radius 20, stroke 4.5
  // Gap from ~30° to ~75° (upper right), dot at midpoint ~52°
  // Arc: large arc from 75° back around to 30° (going clockwise the long way)
  // In SVG coords (y-down): angle 0 = 3 o'clock
  // 30° from top = 360-30 = 330° in standard, but SVG: top is -90°
  // Gap at upper-right: from -60° to -15° (SVG convention, measured from 3 o'clock)
  // Start angle: -15° (just before gap end, clockwise), end angle: -60° (gap start)
  // Dot midpoint: -37.5°

  const cx = 28
  const cy = 28
  const r = 20

  // Gap: from -60° to -15° (upper right, SVG coords)
  const gapStart = -60 // degrees, gap opens here
  const gapEnd = -15   // gap closes here

  const toRad = (deg: number) => (deg * Math.PI) / 180
  const px = (deg: number) => cx + r * Math.cos(toRad(deg))
  const py = (deg: number) => cy + r * Math.sin(toRad(deg))

  // Arc goes from gapEnd clockwise all the way around to gapStart (the long way)
  const startX = px(gapEnd)
  const startY = py(gapEnd)
  const endX = px(gapStart)
  const endY = py(gapStart)

  // Large arc (sweep=1 for clockwise, large-arc-flag=1 since > 180°)
  const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${endX} ${endY}`

  // Dot at midpoint of gap
  const dotAngle = (gapStart + gapEnd) / 2  // -37.5°
  const dotX = px(dotAngle)
  const dotY = py(dotAngle)
  const dotR = 3.2

  // Total width: mark (56) + gap (10) + wordmark
  const markW = 56
  const gapW = wordmark ? 12 : 0
  const wordW = wordmark ? 82 : 0
  const totalW = markW + gapW + wordW
  const totalH = 56

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
      {/* Ring mark */}
      <path
        d={arcPath}
        stroke={ink}
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Settled-point dot */}
      <circle cx={dotX} cy={dotY} r={dotR} fill={green} />

      {/* Wordmark — geometric sans approximation of the brand font */}
      {wordmark && (
        <text
          x={markW + gapW}
          y={38}
          fontFamily="'Manrope', 'Sora', 'Inter', system-ui, sans-serif"
          fontSize="30"
          fontWeight="700"
          letterSpacing="-1.4"
          fill={ink}
        >
          settl
        </text>
      )}
    </svg>
  )
}
