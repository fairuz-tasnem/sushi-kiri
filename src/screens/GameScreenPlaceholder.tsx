import { useEffect, useState } from 'react'
import type { ScreenProps } from '../game/gameScreen'
import Button from '../components/Button'
import GameCanvas from '../components/GameCanvas'
import { levelOrFirst } from '../game/levelProgress'
import type { LevelResult } from '../game/levelProgress'
import { useHandTracking } from '../vision/HandTrackingContext'
import PauseScreen from './PauseScreen'
interface Props extends ScreenProps { onRunEnding: () => void; paused: boolean; level: number; startingLives: number; onLevelEnd: (result: LevelResult) => void; onRetry: () => void }
export default function GameScreenPlaceholder({ onRunEnding, paused, onNavigate, level, startingLives, onLevelEnd, onRetry }: Props) {
  const config = levelOrFirst(level)
  const [ending, setEnding] = useState(false)
  const [score, setScore] = useState(0)
  const [seconds, setSeconds] = useState(config.durationSeconds)
  const [countdown, setCountdown] = useState(0)
  const { status, inputMode } = useHandTracking()
  useEffect(() => {
    if (paused || countdown === 2 || (inputMode !== 'mouse' && status !== 'tracking')) return
    const timer = window.setTimeout(() => setCountdown(n => n + 1), 1000)
    return () => clearTimeout(timer)
  }, [paused, countdown, status, inputMode])
  return <>
    <GameCanvas onEnding={() => { setEnding(true); onRunEnding() }} paused={paused || countdown < 2} level={config} startingLives={startingLives} onScoreChange={setScore} onSecondsLeftChange={setSeconds} onLevelEnd={onLevelEnd} />
    {paused ? <PauseScreen onNavigate={onNavigate} onRetry={onRetry} /> : <>
      <div className="game-hud" data-game-ui>
        <strong>Level {level}</strong><span role="status">Score {score} / {config.targetScore}</span><span>{seconds}s</span>
        <Button disabled={ending} onClick={() => onNavigate('pause')}>Pause</Button><Button onClick={() => onNavigate('start')}>Exit</Button>
      </div>
      {countdown < 2 && <div className="ready-count" role="status">{inputMode === 'mouse' || status === 'tracking' ? ['READY', 'GO!'][countdown] : 'Show your hand to begin'}</div>}
      {!ending && inputMode === 'hand' && countdown === 2 && status !== 'tracking' && <p className="tracking-banner" role="status">{status === 'unavailable' || status === 'idle' ? 'Tracking unavailable — pause to reconnect' : 'Hand not detected — show your index finger'}</p>}
      {ending && <p className="descent-caption" role="status">That’s the last life.</p>}
      {inputMode === 'mouse' && !ending && <span className="input-label">Hold and drag to slice</span>}
    </>}
  </>
}
