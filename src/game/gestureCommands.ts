/**
 * Which hand-gesture command does what on which screen. Pure data and one pure function: no
 * React, no camera, no timers, so the whole table is covered by tests (tests/gestureCommands.test.ts).
 *
 * The gestures themselves (poses, hold times, cooldown, one trigger per hold, "change pose before
 * repeating") are decided in src/vision/gestures.ts and are not touched here: this file only
 * receives a command that has already been recognized.
 *
 *   thumbs-up   start -> game                (play)
 *               pause -> game                (resume the paused game)
 *   open-palm   game  -> pause
 *   v-sign      game, pause, gameOver, levelComplete, levelFailed, victory -> start
 *               start -> goodbye             (a separate V-sign hold: the recognizer will not
 *                                             fire the same gesture twice in one hold, so the
 *                                             V-sign that returned to the menu cannot also open
 *                                             Goodbye; the player has to change pose and repeat it)
 *
 * Everywhere else a command is recognized but does nothing. The browser tab is never closed.
 */
import type { GestureCommandType } from '../vision/gestures'
import type { GameScreen } from './gameScreen'

/** What a command does: go to this screen, and the words shown to the player. */
export interface GestureAction {
  to: GameScreen
  /** Short phrase for the hint, e.g. "starting the game". */
  hint: string
}

/** Screens where the game is running or has just ended. A V-sign from any of them goes to the menu. */
const ACTIVE_OR_RESULT_SCREENS: readonly GameScreen[] = [
  'game',
  'pause',
  'gameOver',
  'levelComplete',
  'levelFailed',
  'victory',
]

/** What the player called each gesture, for the hint. */
export const GESTURE_NAMES: Readonly<Record<GestureCommandType, string>> = {
  'thumbs-up': 'Thumbs-up',
  'open-palm': 'Open palm',
  'v-sign': 'V-sign',
}

/** The action for a command on the current screen, or null when the command is not valid there. */
export function resolveGestureCommand(gesture: GestureCommandType, screen: GameScreen): GestureAction | null {
  switch (gesture) {
    case 'thumbs-up':
      if (screen === 'start') return { to: 'game', hint: 'starting the game' }
      if (screen === 'pause') return { to: 'game', hint: 'resuming' }
      return null
    case 'open-palm':
      if (screen === 'game') return { to: 'pause', hint: 'pausing' }
      return null
    case 'v-sign':
      if (ACTIVE_OR_RESULT_SCREENS.includes(screen)) return { to: 'start', hint: 'back to the main menu' }
      if (screen === 'start') return { to: 'goodbye', hint: 'opening Goodbye' }
      return null
  }
}

/** The hint text for a command: what is happening, or that the command has no effect here. */
export function gestureHintText(gesture: GestureCommandType, action: GestureAction | null): string {
  const name = GESTURE_NAMES[gesture]
  return action ? `${name}: ${action.hint}` : `${name} recognized: not used on this screen`
}
