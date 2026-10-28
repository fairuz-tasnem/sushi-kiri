import { useHandTracking } from '../vision/HandTrackingContext'
import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import CameraNotice from '../components/CameraNotice'
import TrackingNotice from '../components/TrackingNotice'
import ScreenFrame from '../components/ScreenFrame'

/**
 * The pause card. It is drawn by GameScreenPlaceholder while the game is paused (the game
 * canvas stays mounted underneath, frozen), so Resume continues the same game.
 */
export default function PauseScreen({ onNavigate, onRetry }: ScreenProps & { onRetry: () => void }) {
  const { inputMode, setInputMode } = useHandTracking()
  return (
    <ScreenFrame
      title="Paused"
      actions={
        <>
          <Button variant="primary" onClick={() => onNavigate('game')}>
            Resume game
          </Button>
          <Button onClick={onRetry}>Retry level</Button>
          <Button onClick={() => onNavigate('start')}>Back to start</Button>
        </>
      }
    >
<Button onClick={() => setInputMode(inputMode === 'hand' ? 'mouse' : 'hand')}>Use {inputMode === 'hand' ? 'mouse fallback' : 'hand tracking'}</Button>
      <CameraNotice /><TrackingNotice />
      <p className="lead">The game is paused. Nothing moves, spawns or scores until you resume.</p>
      <p className="note">
        With your camera on: thumbs-up resumes, and a V-sign held for 1 second returns to the main
        menu (that ends this game).
      </p>
    </ScreenFrame>
  )
}
