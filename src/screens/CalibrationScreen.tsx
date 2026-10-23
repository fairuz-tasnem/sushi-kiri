import type { ScreenProps } from '../game/gameScreen'
import { useCamera } from '../camera/CameraContext'
import Button from '../components/Button'
import CameraNotice from '../components/CameraNotice'
import TrackingNotice from '../components/TrackingNotice'
import ScreenFrame from '../components/ScreenFrame'

export default function CalibrationScreen({ onNavigate }: ScreenProps) {
  const { status } = useCamera()

  return (
    <ScreenFrame
      title="Calibration"
      placeholder
      actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
    >
      <p className="lead">
        {status === 'ready'
          ? 'Your camera is on. Hold up one hand: a cursor should follow your index fingertip on the preview, which shows you mirrored, like a mirror.'
          : 'Calibration turns on your camera.'}
      </p>
      <CameraNotice />
      <TrackingNotice />
    </ScreenFrame>
  )
}
