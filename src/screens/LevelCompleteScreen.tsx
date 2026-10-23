import type { ScreenProps } from '../game/gameScreen'
import type { LevelResult } from '../game/levelProgress'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

interface LevelCompleteScreenProps extends ScreenProps {
  /** The level that was just won, or null if this screen was opened without playing (dev picker). */
  result: LevelResult | null
  /** Starts the next level with the lives that were left. */
  onNextLevel: () => void
}

export default function LevelCompleteScreen({ onNavigate, result, onNextLevel }: LevelCompleteScreenProps) {
  return (
    <ScreenFrame
      title="Level Complete"
      placeholder
      actions={
        <>
          {result && (
            <Button variant="primary" onClick={onNextLevel}>
              Next level
            </Button>
          )}
          <Button onClick={() => onNavigate('start')}>Back to start</Button>
        </>
      }
    >
      {result ? (
        <>
          <p className="lead">Level {result.level} complete!</p>
          <p className="game-score" role="status">
            Score: <strong>{result.score}</strong> / {result.target}
          </p>
          <p className="note">
            Lives carried into level {result.level + 1}: {result.livesLeft}.
          </p>
        </>
      ) : (
        <p className="note">Play a level to see its result here.</p>
      )}
    </ScreenFrame>
  )
}
