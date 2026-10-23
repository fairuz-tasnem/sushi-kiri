import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

export default function LevelFailedScreen({ onNavigate }: ScreenProps) {
  return (
    <ScreenFrame
      title="Level Failed"
      placeholder
      actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
    >
      <p className="lead">This screen will appear when a level is not completed.</p>
      <p className="note">
        There are no levels yet, so this is a static placeholder reserved for a later stage.
      </p>
    </ScreenFrame>
  )
}
