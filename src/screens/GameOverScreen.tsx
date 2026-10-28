import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

interface GameOverScreenProps extends ScreenProps {
  /** The score of the game that just ended. */
  finalScore: number
  level: number
}

export default function GameOverScreen({ onNavigate, finalScore, level }: GameOverScreenProps) {
  return (
    <ScreenFrame
      title="Game Over"
      actions={
        <>
          {/* Opening the Game screen again mounts a new game: full lives, score 0. */}
          <Button variant="primary" onClick={() => onNavigate('game')}>
            Play again
          </Button>
          <Button onClick={() => onNavigate('start')}>Back to start</Button>
        </>
      }
    >
      <p className="lead gameover-lead">You ran out of lives.</p>
      <p className="game-score" role="status">
        Final score: <strong>{finalScore}</strong>
      </p>
      <p className="note">
        You reached level {level}. Play again starts a new run with three lives.
      </p>
    </ScreenFrame>
  )
}
