/**
 * Large custom numpad for USDC amount entry.
 * Mobile-first, 48px+ touch targets.
 */

import { Delete } from 'lucide-react'
import { applyKeypadPress } from '@/lib/amount'

interface Props {
  value: string
  onChange: (value: string) => void
}

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
]

export default function Keypad({ value, onChange }: Props) {
  function press(key: string) {
    onChange(applyKeypadPress(value, key))
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-2" role="group" aria-label="Amount keypad">
      {KEYS.flat().map(key => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className="flex h-14 items-center justify-center rounded-2xl text-xl font-semibold transition-all active:scale-95"
          style={{
            background: 'var(--surface-muted)',
            color: 'var(--ink)',
            border: '1px solid var(--border)',
            minHeight: '48px',
          }}
          aria-label={key === 'backspace' ? 'Delete' : key}
        >
          {key === 'backspace' ? <Delete className="h-5 w-5" style={{ color: 'var(--muted)' }} /> : key}
        </button>
      ))}
    </div>
  )
}
