import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

/**
 * The Exit / Goodbye screen. A browser page cannot (and should not) close its own tab, so this
 * is only an in-game screen: it says goodbye and offers a way back. Nothing here calls
 * window.close() or leaves the page.
 */
export default function GoodbyeScreen({ onNavigate }: ScreenProps) {
  return (
    <ScreenFrame
      title="Goodbye"
      actions={<Button variant="primary" onClick={() => onNavigate('start')}>Back to main menu</Button>}
    >
      <p className="lead">Thanks for playing Sushi Kiri.</p>
      <p className="note">
        The game cannot close your browser tab for you. When you are done, close the tab
        yourself, or go back to the main menu to play again.
      </p>
    </ScreenFrame>
  )
}
