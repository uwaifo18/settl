/**
 * Premium tactile keypad — large keys, haptic feedback, new design tokens.
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

function haptic() {
  try { if ('vibrate' in navigator) navigator.vibrate(6) } catch { /* ignore */ }
}

export default function Keypad({ value, onChange }: Props) {
  function press(key: string) {
    haptic()
    onChange(applyKeypadPress(value, key))
  }

  return (
    <div className="grid grid-cols-3 gap-2 p-2" role="group" aria-label="Amount keypad">
      {KEYS.flat().map(key => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          className="flex items-center justify-center rounded-2xl text-2xl font-semibold transition-all active:scale-[0.92]"
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            minHeight: '64px',
          }}
          aria-label={key === 'backspace' ? 'Delete' : key}
        >
          {key === 'backspace'
            ? <Delete className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
            : key}
        </button>
      ))}
    </div>
  )
}
