/**
 * Screen state model for Sushi Kiri.
 *
 * The whole app is always on exactly ONE of the screens listed below.
 * App.tsx keeps that single value in state, and every screen changes it by
 * calling `onNavigate('some-screen')`. There is no router and there are no
 * per-screen boolean flags.
 *
 * To add a screen later:
 *   1. add its name to GAME_SCREENS
 *   2. add a label to SCREEN_LABELS (TypeScript will complain until you do)
 *   3. add a case for it in src/screens/CurrentScreen.tsx
 *
 * Navigation (only the real links are wired up):
 *   start -> instructions | settings | calibration
 *   instructions, settings, calibration -> start
 *   game -> start | gameOver     (gameOver: the last life was lost, Task 4)
 *   gameOver -> game | start     (game: "Play again" starts a fresh game)
 *   levelComplete, levelFailed, victory -> start
 *   pause -> game | start     (game: resume; the paused game is kept, not restarted)
 *   start -> goodbye, goodbye -> start     (goodbye: a simple "thanks for playing" screen)
 *
 * Hand gestures (Task 6) use the same navigation: see src/game/gestureCommands.ts for the full
 * table of which gesture moves between which screens.
 *
 * Nothing links INTO pause, levelComplete, levelFailed or victory yet, because the gameplay
 * that would trigger them does not exist. Calibration has no link into the game either; open
 * the Game screen with the development panel. In development builds only, the "jump to
 * screen" panel (DevScreenPicker) lets you open any screen so you can review how it looks.
 */

export const GAME_SCREENS = [
  'start',
  'instructions',
  'settings',
  'calibration',
  'game',
  'pause',
  'levelComplete',
  'levelFailed',
  'gameOver',
  'victory',
  'goodbye',
] as const

export type GameScreen = (typeof GAME_SCREENS)[number]

/** Function that every screen receives so it can move to another screen. */
export type NavigateFn = (screen: GameScreen) => void

/** Props shared by every screen component. */
export interface ScreenProps {
  onNavigate: NavigateFn
}

/** Human-readable names, used by the development screen picker. */
export const SCREEN_LABELS: Record<GameScreen, string> = {
  start: 'Start',
  instructions: 'Instructions',
  settings: 'Settings',
  calibration: 'Calibration',
  game: 'Game',
  pause: 'Pause',
  levelComplete: 'Level Complete',
  levelFailed: 'Level Failed',
  gameOver: 'Game Over',
  victory: 'Victory',
  goodbye: 'Goodbye',
}
