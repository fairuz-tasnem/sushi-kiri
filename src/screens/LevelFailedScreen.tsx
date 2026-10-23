import type { ScreenProps } from '../game/gameScreen'
import type { LevelResult } from '../game/levelProgress'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'

interface LevelFailedScreenProps extends ScreenProps {
  /** The level that was just lost, or null if this screen was opened without playing (dev picker). */
  result: LevelResult | null
  /** Plays the same level again with full lives and a fresh 60-second clock. */
  onRetryLevel: () => void
}

export default function LevelFailedScreen({ onNavigate, result, onRetryLevel }: LevelFailedScreenProps) {
  return (
    <ScreenFrame
      title="Level Failed"
      placeholder
      actions={
        <>
          {result && (
            <Button variant="primary" onClick={onRetryLevel}>
              Retry level
            </Button>
          )}
          <Button onClick={() => onNavigate('start')}>Back to start</Button>
        </>
      }
    >
      {result ? (
        <>
          <p className="lead">Time ran out on level {result.level}.</p>
          <p className="game-score" role="status">
            Score: <strong>{result.score}</strong> / {result.target}
          </p>
          <p className="note">Retrying starts level {result.level} again with full lives and a fresh clock.</p>
        </>
      ) : (
        <p className="note">Play a level to see its result here.</p>
      )}
    </ScreenFrame>
  )
}
