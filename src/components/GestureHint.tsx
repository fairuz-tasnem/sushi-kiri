import type { GestureHint as GestureHintData } from '../vision/useGestureCommands'

/**
 * A small pill that names the gesture just recognized and what it did ("Thumbs-up: starting the
 * game"). role="status" lets screen readers announce it. It never takes clicks (see
 * .gesture-hint in components.css). The `key` makes a repeated command restart the display.
 */
export default function GestureHint({ hint }: { hint: GestureHintData | null }) {
  if (!hint) return null
  return (
    <p
      key={hint.id}
      className={hint.used ? 'gesture-hint' : 'gesture-hint gesture-hint--unused'}
      role="status"
    >
      {hint.text}
    </p>
  )
}
