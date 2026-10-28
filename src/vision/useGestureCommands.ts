import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameScreen } from '../game/gameScreen'
import { gestureHintText, resolveGestureCommand } from '../game/gestureCommands'
import type { GestureCommandListener } from './gestures'

/** How long the hint stays on screen. */
const HINT_VISIBLE_MS = 2200

export interface GestureHint {
  /** Changes for every command, so the same text twice in a row still restarts the display. */
  id: number
  text: string
  /** False when the command was recognized but does nothing on this screen. */
  used: boolean
}

/**
 * Connects recognized gesture commands to the screen-state system, and returns the hint to show.
 * Call it once, in App.tsx.
 *
 * Mouse and keyboard are not involved at all: buttons keep calling onNavigate exactly as
 * before, whether or not the camera or hand tracking works. This hook only ADDS a second way to
 * call onNavigate, and it does nothing at all when no commands arrive (tracking lost, camera off).
 *
 * One command arrives per completed hold (the recognizer guarantees that), and it is applied
 * once, to the screen that is showing at that moment.
 *
 * @param screen    the current screen
 * @param onNavigate  the same function every screen's buttons use
 * @param subscribe   HandTrackingState.subscribeGestureCommands
 */
export function useGestureCommands(
  screen: GameScreen,
  onNavigate: (screen: GameScreen) => void,
  subscribe: (listener: GestureCommandListener) => () => void,
): GestureHint | null {
  const [hint, setHint] = useState<GestureHint | null>(null)

  // Read through refs so the subscription is made once and never sees a stale screen.
  const screenRef = useRef(screen)
  const navigateRef = useRef(onNavigate)
  const idRef = useRef(0)
  const timerRef = useRef(0)
  useEffect(() => {
    screenRef.current = screen
    navigateRef.current = onNavigate
  }, [screen, onNavigate])

  const show = useCallback((text: string, used: boolean) => {
    idRef.current += 1
    setHint({ id: idRef.current, text, used })
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setHint(null), HINT_VISIBLE_MS)
  }, [])

  useEffect(() => {
    const unsubscribe = subscribe((command) => {
      const action = resolveGestureCommand(command.gesture, screenRef.current)
      show(gestureHintText(command.gesture, action), action !== null)
      if (!action) return
      screenRef.current = action.to // so a second command in the same instant sees the new screen
      navigateRef.current(action.to)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(timerRef.current)
    }
  }, [subscribe, show])

  return hint
}
