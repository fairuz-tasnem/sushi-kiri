import type { ReactNode } from 'react'
import { useFocusOnMount } from '../hooks/useFocusOnMount'
import ChopstickRule from './ChopstickRule'

interface ScreenFrameProps {
  title: string
  /** Shows a "Placeholder" tag above the title. */
  placeholder?: boolean
  /** Replaces the default tag text, e.g. "Draft". Only used with `placeholder`. */
  tagLabel?: string
  /** Buttons for leaving the screen. Rendered at the bottom. */
  actions: ReactNode
  children: ReactNode
}

/**
 * Shared layout for every screen except Start: optional tag, title, a short
 * decorative rule, the content, and a row of action buttons.
 */
export default function ScreenFrame({
  title,
  placeholder = false,
  tagLabel = 'Placeholder',
  actions,
  children,
}: ScreenFrameProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <section className="screen" aria-labelledby="screen-title">
      <header className="screen__header">
        {placeholder && <p className="tag">{tagLabel}</p>}
        <h1 id="screen-title" className="screen__title" ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
        <ChopstickRule />
      </header>

      <div className="screen__body">{children}</div>

      <div className="screen__actions">{actions}</div>
    </section>
  )
}
