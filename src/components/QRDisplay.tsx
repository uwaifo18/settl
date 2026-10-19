/**
 * High-contrast QR code display for payment links.
 * Uses qrcode.react with error correction level M.
 */

import { QRCodeSVG } from 'qrcode.react'

interface Props {
  url: string
  size?: number
}

export default function QRDisplay({ url, size = 240 }: Props) {
  return (
    <div
      className="flex items-center justify-center rounded-2xl p-4"
      style={{ background: '#ffffff', border: '2px solid var(--border)' }}
      aria-label="QR code for payment"
    >
      <QRCodeSVG
        value={url}
        size={size}
        level="M"
        includeMargin={true}
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  )
}
