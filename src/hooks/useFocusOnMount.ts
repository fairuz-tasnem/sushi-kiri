import { useEffect, useRef } from 'react'

/**
 * Moves keyboard focus to an element when its screen appears.
 *
 * Without this, pressing a button that swaps the screen leaves focus on a
 * button that no longer exists, and keyboard and screen-reader users lose
 * their place. We focus the screen's heading instead; the next Tab press then
 * lands on the first button of the new screen.
 */
export function useFocusOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])

  return ref
}
