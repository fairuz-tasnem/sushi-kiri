import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

export default function InstructionsScreen({ onNavigate }: ScreenProps) {
  return (
    <ScreenFrame
      title="Instructions"
      placeholder
      tagLabel="Draft"
      actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
    >
      <p className="lead">
        Sushi Kiri is played with your hands in front of a camera. Slicing sushi earns you a
        score.
      </p>

      <ol className="steps">
        <li>
          <strong>Set up your camera.</strong> Sit where your hands are easy to see, with
          decent light.
        </li>
        <li>
          <strong>Calibrate.</strong> A short calibration step will check that the game can
          see your hand.
        </li>
        <li>
          <strong>Slice.</strong> Move your hand across the screen to cut the sushi.
        </li>
      </ol>

      <p className="note">
        This is a draft. None of the steps above work yet, and the final instructions will be
        written once the game can be played.
      </p>
    </ScreenFrame>
  )
}
