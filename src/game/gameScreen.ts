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


export type NavigateFn = (screen: GameScreen) => void


export interface ScreenProps {
  onNavigate: NavigateFn
}


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
