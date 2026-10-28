import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'
export default function InstructionsScreen({ onNavigate }: ScreenProps) {
  return <ScreenFrame title="How to play" actions={<Button onClick={() => onNavigate('start')}>Main menu</Button>}>
    <ol className="steps">
      <li>Choose Play, allow the camera, then move your index finger to calibrate. A three-second countdown starts each level.</li>
      <li>Swipe through sushi for 10 points. Soy sauce doubles points for five seconds. Cutting wasabi costs one life; missing an object costs nothing.</li>
      <li>Reach the target within 60 seconds. Five levels get faster. Your three lives carry between levels; retrying a level restores them.</li>
      <li>Point at a button for 0.7 seconds to select it. Move away before selecting again.</li>
    </ol>
    <p>Hold thumbs-up for 0.8 seconds to Play or Resume, an open palm for 0.8 seconds to Pause, or a V-sign for 1 second to Exit. Release the pose between commands.</p>
    <p>Keyboard: Enter/Space to Play or Resume, P to Pause/Resume, Escape to Exit. Tab and Enter also operate buttons. Exit once returns to the menu; Exit again ends the session.</p>
    <p>Enable optional voice in Settings, then say “play”, “pause”, “resume”, or “exit”. “Kiri” before the command also works. Mouse and keyboard control menus; slicing uses your hand.</p>
  </ScreenFrame>
}
