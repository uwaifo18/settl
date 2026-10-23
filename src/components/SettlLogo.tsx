/**
 * Settl logo — open circle with green dot + bold wordmark.
 * Matches the brand identity: nearly-complete black circle, green filled dot at top-right,
 * bold lowercase "settl" wordmark in black.
 */

interface Props {
  /** Height of the logo in px. Width scales proportionally. Default 36. */
  size?: number
  /** Whether to show on a dark background (inverts circle + text to white). Default false. */
  dark?: boolean
}

export default function SettlLogo({ size = 36, dark = false }: Props) {
  // The icon is ~52×52 units, wordmark extends ~200 units to the right
  // Total viewBox width: ~280, height: 52
  const inkColor = dark ? '#ffffff' : '#111111'

  return (
    <svg
      width={(size / 52) * 280}
      height={size}
      viewBox="0 0 280 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Settl"
      role="img"
    >
      {/* Open circle — nearly complete arc, gap at top-right */}
      <circle
        cx="26"
        cy="26"
        r="20"
        stroke={inkColor}
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeDasharray="109 17"
        strokeDashoffset="-4"
      />
      {/* Green dot at top-right of the circle gap */}
      <circle cx="42" cy="9" r="5" fill="#22c55e" />

      {/* Wordmark: "settl" — bold, lowercase, tight tracking */}
      <text
        x="64"
        y="38"
        fontFamily="'Space Grotesk', 'DM Sans', system-ui, sans-serif"
        fontWeight="700"
        fontSize="36"
        letterSpacing="-1"
        fill={inkColor}
      >
        settl
      </text>
    </svg>
  )
}
