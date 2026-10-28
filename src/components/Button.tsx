import { playSound, unlockAudio } from '../game/audio'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Small text shown at the right edge of the button, e.g. "Placeholder". */
  note?: string
  children: ReactNode
}

/**
 * The only button style in the game. It is a real <button>, so mouse, Enter
 * and Space all work without extra code. Hover, active and focus styles live
 * in src/styles/components.css (.btn).
 */
export default function Button({
  variant = 'secondary',
  note,
  children,
  className,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  const classes = ['btn', `btn--${variant}`, className].filter(Boolean).join(' ')

  return (
    <button type={type} className={classes} {...rest} onClick={event => { unlockAudio(); playSound('ui-click'); onClick?.(event) }}>
      <span className="btn__label">{children}</span>
      {/* The plain space keeps the spoken name readable: "Calibration Placeholder". */}
      {note && ' '}
      {note && <span className="btn__note">{note}</span>}
    </button>
  )
}
