import { useRewardReveal } from '../hooks/useRewardReveal'
import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

export default function VictoryScreen({ onNavigate }: ScreenProps) {
  const revealed = useRewardReveal()
  return (
    <ScreenFrame
      title="Victory"
      actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
    >
      <p className={`reward-reveal ${revealed ? 'is-revealed' : ''}`} role="status">{revealed ? 'Five levels. Nicely done.' : 'One last look…'}</p>
      <p className="note">
        Your best scores and unlocked levels are saved on this browser. Return to the menu to play any unlocked level.
      </p>
    </ScreenFrame>
  )
}
