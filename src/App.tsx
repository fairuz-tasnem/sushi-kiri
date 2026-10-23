import { useEffect, useState } from 'react'
import type { GameScreen } from './game/gameScreen'
import { CameraContext } from './camera/CameraContext'
import { useCameraStream } from './camera/useCameraStream'
import CurrentScreen from './screens/CurrentScreen'
import { HandTrackingContext } from './vision/HandTrackingContext'
import { useHandTracker } from './vision/useHandTracker'
import { useGestureCommands } from './vision/useGestureCommands'
import WebcamPreview from './components/WebcamPreview'
import HandCursor from './components/HandCursor'
import GestureHint from './components/GestureHint'
import DevScreenPicker from './components/DevScreenPicker'

/**
 * Screens that need the camera. The browser's permission prompt appears the
 * first time one of these opens; the camera then stays on for every screen.
 */
const CAMERA_SCREENS: readonly GameScreen[] = ['calibration', 'game', 'pause']

/**
 * Screens that draw the fingertip cursor. Hand tracking itself keeps running on every
 * screen (so Pause and the result screens never restart it); only the drawing is limited.
 */
const CURSOR_SCREENS: readonly GameScreen[] = ['calibration', 'game']

export default function App() {
  // The one piece of navigation state. See src/game/gameScreen.ts.
  const [screen, setScreen] = useState<GameScreen>('start')

  // The score of the game that last ended, kept here only so the Game Over screen can show it.
  // Everything else about a game (lives, objects, bonus) lives inside the Game screen's canvas
  // and disappears with it, which is what makes the next game start fresh.
  const [finalScore, setFinalScore] = useState(0)

  // The camera lives here, above every screen, so changing screens never restarts it.
  const camera = useCameraStream()
  const { status, start } = camera

  // Hand tracking also lives here, above every screen, and reads the SAME <video> element
  // that WebcamPreview renders, so there is still exactly one camera stream.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const tracking = useHandTracker(video, status === 'ready')

  // Hand-gesture commands (thumbs-up, open palm, V-sign) call the same setScreen the buttons use.
  // They only add a second way to navigate: mouse and keyboard work whatever the camera is doing.
  const gestureHint = useGestureCommands(screen, setScreen, tracking.subscribeGestureCommands)

  useEffect(() => {
    if (CAMERA_SCREENS.includes(screen) && status === 'idle') void start()
  }, [screen, status, start])

  // On the Playing screen (and while it is paused) the live video fills the whole window behind the game.
  const cameraIsBackground = (screen === 'game' || screen === 'pause') && status === 'ready'

  return (
    <CameraContext.Provider value={camera}>
      <HandTrackingContext.Provider value={tracking}>
        <div className={cameraIsBackground ? 'app app--playing' : 'app'}>
          <div className="tray">
            <main className="tray__main">
              <div className="tray__inner">
                <CurrentScreen
                  screen={screen}
                  onNavigate={setScreen}
                  finalScore={finalScore}
                  onGameOver={setFinalScore}
                />
              </div>
            </main>
          </div>

          {/* One video element for the whole session: a small corner preview on most
              screens, the full-window background on the Playing screen. */}
          <WebcamPreview background={cameraIsBackground} onVideoElement={setVideo} />

          {/* The fingertip cursor, drawn over that video on the Calibration and Playing screens. */}
          <HandCursor
            video={video}
            subscribe={tracking.subscribe}
            visible={CURSOR_SCREENS.includes(screen)}
          />

          {/* Names the gesture just recognized and what it did; disappears by itself. */}
          <GestureHint hint={gestureHint} />

          {/* Development builds only; removed from the production build. */}
          {import.meta.env.DEV && <DevScreenPicker current={screen} onNavigate={setScreen} />}
        </div>
      </HandTrackingContext.Provider>
    </CameraContext.Provider>
  )
}
