import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

export default function VictoryScreen({ onNavigate }: ScreenProps) {
  return (
    <ScreenFrame
      title="Victory"
      placeholder
      actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
    >
      <p className="lead">This screen will appear when the whole game is won.</p>
      <p className="note">
        There is no game to win yet, so this is a static placeholder reserved for a later
        stage.
      </p>
    </ScreenFrame>
  )
}
