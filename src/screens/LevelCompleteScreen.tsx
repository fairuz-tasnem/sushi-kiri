import { useRewardReveal } from '../hooks/useRewardReveal'
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
  const revealed = useRewardReveal()
  return (
    <ScreenFrame
      title="Level Complete"
      actions={
        <>
          {result && (
            <Button disabled={!revealed} variant="primary" onClick={onNextLevel}>
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
          <div className={`reward-reveal ${revealed ? 'is-revealed' : ''}`} aria-live="polite">{revealed ? `Level ${result.level + 1} is ready.` : 'Let’s see how you did…'}</div>
          <div className="reward-details" hidden={!revealed}><p className="game-score" role="status">
            Score: <strong>{result.score}</strong> / {result.target}
          </p>
          <p className="note">
            Lives carried into level {result.level + 1}: {result.livesLeft}.
          </p></div>
        </>
      ) : (
        <p className="note">Play a level to see its result here.</p>
      )}
    </ScreenFrame>
  )
}
