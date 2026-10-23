import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

interface GameOverScreenProps extends ScreenProps {
  /** The score of the game that just ended. */
  finalScore: number
}

export default function GameOverScreen({ onNavigate, finalScore }: GameOverScreenProps) {
  return (
    <ScreenFrame
      title="Game Over"
      placeholder
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
      <p className="lead">You ran out of lives.</p>
      <p className="game-score" role="status">
        Final score: <strong>{finalScore}</strong>
      </p>
      <p className="note">
        Levels and a highest-level record are not built yet, so only the score is shown.
      </p>
    </ScreenFrame>
  )
}
