import { useState } from 'react'
import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import CameraNotice from '../components/CameraNotice'
import TrackingNotice from '../components/TrackingNotice'
import ScreenFrame from '../components/ScreenFrame'
import GameCanvas from '../components/GameCanvas'
import { levelOrFirst } from '../game/levelProgress'
import type { LevelResult } from '../game/levelProgress'
import PauseScreen from './PauseScreen'

/**
 * Named GameScreenPlaceholder (not GameScreen) because `GameScreen` is already
 * the name of the screen-state type in src/game/gameScreen.ts.
 */
interface GameScreenProps extends ScreenProps {
  /** True on the Pause screen: the same game stays mounted but frozen, with the pause card on top. */
  paused: boolean
  /** The level to play (1 to 5). A different level is a new game screen, so a new canvas. */
  level: number
  /** Lives this level starts with. */
  startingLives: number
  /** Called once when the level ends in any way; App decides which screen comes next. */
  onLevelEnd: (result: LevelResult) => void
}

export default function GameScreenPlaceholder({
  paused,
  onNavigate,
  level,
  startingLives,
  onLevelEnd,
}: GameScreenProps) {
  const levelConfig = levelOrFirst(level)
  // The Canvas owns the real score (it changes inside the game loop) and reports each change
  // here, so this card can show it. It changes only when a sushi is cut, so a React state is cheap.
  const [score, setScore] = useState(0)
  // Whole seconds left on the level clock; the canvas reports it about once a second.
  const [secondsLeft, setSecondsLeft] = useState(levelConfig.durationSeconds)

  return (
    <>
      {/* Starts its game loop when this screen opens and stops it when the screen closes. */}
      <GameCanvas
        paused={paused}
        level={levelConfig}
        startingLives={startingLives}
        onScoreChange={setScore}
        onSecondsLeftChange={setSecondsLeft}
        // The canvas has already stopped its loop. App records the result and opens the next
        // screen; leaving this screen unmounts the canvas, so the next level is a fresh canvas.
        onLevelEnd={onLevelEnd}
      />
      {paused ? (
        <PauseScreen onNavigate={onNavigate} />
      ) : (
      <ScreenFrame
        title={`Level ${levelConfig.level}`}
        placeholder
        actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
      >
        <p className="lead">Swipe your index fingertip through the flying sushi to slice it.</p>
        {/* role="status" announces the new total to screen readers each time it changes. */}
        <p className="game-score" role="status">
          Score: <strong>{score}</strong> / {levelConfig.targetScore}
        </p>
        <p className="note">
          Time left: <strong>{secondsLeft}</strong> s. Reach {levelConfig.targetScore} points
          before the time runs out. Cut a soy sauce bottle for double points for 5 seconds. Do
          not cut the wasabi: each one costs a life, and lives carry over to the next level.
        </p>
        <p className="note">
          Gestures (camera on): open palm pauses, and a V-sign held for 1 second returns to the
          main menu.
        </p>
        <CameraNotice />
        <TrackingNotice />
      </ScreenFrame>
      )}
    </>
  )
}
