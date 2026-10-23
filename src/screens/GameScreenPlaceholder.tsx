import { useState } from 'react'
import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import CameraNotice from '../components/CameraNotice'
import TrackingNotice from '../components/TrackingNotice'
import ScreenFrame from '../components/ScreenFrame'
import GameCanvas from '../components/GameCanvas'
import PauseScreen from './PauseScreen'

/**
 * Named GameScreenPlaceholder (not GameScreen) because `GameScreen` is already
 * the name of the screen-state type in src/game/gameScreen.ts.
 */
interface GameScreenProps extends ScreenProps {
  /** True on the Pause screen: the same game stays mounted but frozen, with the pause card on top. */
  paused: boolean
  /** Called once, with the final score, when the last life is lost. */
  onGameOver: (finalScore: number) => void
}

export default function GameScreenPlaceholder({ paused, onNavigate, onGameOver }: GameScreenProps) {
  // The Canvas owns the real score (it changes inside the game loop) and reports each change
  // here, so this card can show it. It changes only when a sushi is cut, so a React state is cheap.
  const [score, setScore] = useState(0)

  return (
    <>
      {/* Starts its game loop when this screen opens and stops it when the screen closes. */}
      <GameCanvas
        paused={paused}
        onScoreChange={setScore}
        onGameOver={(finalScore) => {
          // The canvas has already stopped its loop. Remember the score for the Game Over
          // screen, then open it; leaving this screen unmounts the canvas, so the next visit
          // to the Game screen starts a completely fresh game.
          onGameOver(finalScore)
          onNavigate('gameOver')
        }}
      />
      {paused ? (
        <PauseScreen onNavigate={onNavigate} />
      ) : (
      <ScreenFrame
        title="Game"
        placeholder
        actions={<Button onClick={() => onNavigate('start')}>Back to start</Button>}
      >
        <p className="lead">Swipe your index fingertip through the flying sushi to slice it.</p>
        {/* role="status" announces the new total to screen readers each time it changes. */}
        <p className="game-score" role="status">
          Score: <strong>{score}</strong>
        </p>
        <p className="note">
          Cut a soy sauce bottle for double points for 5 seconds. Do not cut the wasabi: each one
          costs a life, and you have 3. Levels are not built yet.
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
