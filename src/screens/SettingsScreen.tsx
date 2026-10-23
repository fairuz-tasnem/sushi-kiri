import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

export default function SettingsScreen({ onNavigate }: ScreenProps) {
  return (
    <ScreenFrame
      title="Settings"
      placeholder
      actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
    >
      <p className="lead">There is nothing to change here yet. These areas are set aside for later:</p>

      <dl className="status-list">
        <div className="status-list__row">
          <dt>Camera</dt>
          <dd>No camera settings yet. The camera turns on when you open Calibration.</dd>
        </div>
        <div className="status-list__row">
          <dt>Sound</dt>
          <dd>Not available yet. Reserved for when audio is added.</dd>
        </div>
      </dl>
    </ScreenFrame>
  )
}
