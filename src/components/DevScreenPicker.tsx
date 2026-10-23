import { GAME_SCREENS, SCREEN_LABELS } from '../game/gameScreen'
import type { GameScreen, NavigateFn } from '../game/gameScreen'

interface DevScreenPickerProps {
  current: GameScreen
  onNavigate: NavigateFn
}

/**
 * Development-only shortcut panel.
 *
 * Nothing in the Day 1 game leads to the gameplay screens (game, pause, level
 * complete, and so on) because gameplay does not exist yet. This panel lets
 * you open any screen directly to check how it looks. App.tsx only renders it
 * when `import.meta.env.DEV` is true, so it is not part of `npm run build`.
 */
export default function DevScreenPicker({ current, onNavigate }: DevScreenPickerProps) {
  return (
    <details className="dev-picker">
      <summary className="dev-picker__summary">Dev only: jump to screen</summary>
      <ul className="dev-picker__list">
        {GAME_SCREENS.map((screen) => (
          <li key={screen}>
            <button
              type="button"
              className="dev-picker__button"
              aria-current={screen === current ? 'page' : undefined}
              onClick={() => onNavigate(screen)}
            >
              {SCREEN_LABELS[screen]}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
