/**
 * Settl logo — matches brand identity exactly.
 * Nearly-complete bold black circle, green filled dot at top-right gap,
 * bold lowercase "settl" wordmark.
 */

interface Props {
  /** Height of the logo in px. Width scales proportionally. Default 36. */
  size?: number
  /** Whether to show on a dark background (inverts circle + text to white). */
  dark?: boolean
}

export default function SettlLogo({ size = 36, dark = false }: Props) {
  const inkColor = dark ? '#ffffff' : '#111111'
  // ViewBox: icon occupies 0-80, wordmark extends to 380, height 80
  const scale = size / 80

  return (
    <svg
      width={380 * scale}
      height={size}
      viewBox="0 0 380 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Settl"
      role="img"
    >
      {/* Nearly-complete circle — gap at top-right, thick stroke, round cap */}
      <circle
        cx="40"
        cy="40"
        r="30"
        stroke={inkColor}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="168 24"
        strokeDashoffset="-6"
      />
      {/* Green dot at the midpoint of the gap */}
      <circle cx="61" cy="19" r="7" fill="#22c55e" />

      {/* Wordmark */}
      <text
        x="90"
        y="58"
        fontFamily="'DM Sans','Inter','Space Grotesk',system-ui,sans-serif"
        fontWeight="800"
        fontSize="56"
        letterSpacing="-2"
        fill={inkColor}
      >
        settl
      </text>
    </svg>
  )
}
