import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameScreen } from './game/gameScreen'
import { gameConfig } from './game/gameConfig'
import { newRun, nextRunSetup } from './game/levelProgress'
import type { LevelResult, RunSetup } from './game/levelProgress'
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
  // The current screen, readable from callbacks without going stale (see go() below).
  const screenRef = useRef<GameScreen>('start')

  // The score of the game that last ended, kept here only so the Game Over screen can show it.
  // Everything else about a level (objects, bonus, the level clock) lives inside the Game
  // screen's canvas and disappears with it, which is what makes the next level start fresh.
  const [finalScore, setFinalScore] = useState(0)

  // Which level the Game screen plays next and how many lives it starts with. This is the only
  // thing that has to survive between levels, so it lives here, above the Game screen.
  const [run, setRun] = useState<RunSetup>(() => newRun(gameConfig.startingLives))
  // How the level that just ended went, for the Level Complete and Level Failed screens.
  const [lastResult, setLastResult] = useState<LevelResult | null>(null)

  /** The one place the screen changes, so screenRef always matches what is showing. */
  const go = useCallback((next: GameScreen) => {
    screenRef.current = next
    setScreen(next)
  }, [])

  /**
   * Navigation for buttons, gestures and the dev picker. Opening the Game screen from anywhere
   * except Pause (which resumes the same game) begins a NEW run: level 1 with full lives. The
   * level flow below (Next level, Retry level) skips this rule on purpose by calling go() itself.
   */
  const navigate = useCallback(
    (next: GameScreen) => {
      const from = screenRef.current
      if (next === 'game' && from !== 'pause' && from !== 'game') {
        setRun(newRun(gameConfig.startingLives))
      }
      go(next)
    },
    [go],
  )

  /**
   * The Game screen reports its level ending here, once. Decide the next setup and open the
   * matching screen. Ignored if the player has already left the Game screen (a late callback).
   */
  const handleLevelEnd = useCallback(
    (result: LevelResult) => {
      if (screenRef.current !== 'game' && screenRef.current !== 'pause') return
      setLastResult(result)
      setRun(nextRunSetup(result, gameConfig.startingLives))
      switch (result.outcome) {
        case 'complete':
          go('levelComplete')
          break
        case 'victory':
          go('victory')
          break
        case 'failed':
          go('levelFailed')
          break
        case 'gameOver':
          setFinalScore(result.score)
          go('gameOver')
          break
      }
    },
    [go],
  )

  // Next level and Retry level: the run was already set up by handleLevelEnd, so just open the game.
  const startPreparedLevel = useCallback(() => go('game'), [go])

  // The camera lives here, above every screen, so changing screens never restarts it.
  const camera = useCameraStream()
  const { status, start } = camera

  // Hand tracking also lives here, above every screen, and reads the SAME <video> element
  // that WebcamPreview renders, so there is still exactly one camera stream.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const tracking = useHandTracker(video, status === 'ready')

  // Hand-gesture commands (thumbs-up, open palm, V-sign) call the same navigate() the buttons use.
  // They only add a second way to navigate: mouse and keyboard work whatever the camera is doing.
  const gestureHint = useGestureCommands(screen, navigate, tracking.subscribeGestureCommands)

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
                  onNavigate={navigate}
                  finalScore={finalScore}
                  level={run.level}
                  startingLives={run.lives}
                  onLevelEnd={handleLevelEnd}
                  lastResult={lastResult}
                  onNextLevel={startPreparedLevel}
                  onRetryLevel={startPreparedLevel}
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
          {import.meta.env.DEV && <DevScreenPicker current={screen} onNavigate={navigate} />}
        </div>
      </HandTrackingContext.Provider>
    </CameraContext.Provider>
  )
}
