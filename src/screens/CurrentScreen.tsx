import type { Preferences } from '../game/preferences'
import type { GameScreen, NavigateFn } from '../game/gameScreen'
import type { LevelResult } from '../game/levelProgress'
import StartScreen from './StartScreen'
import InstructionsScreen from './InstructionsScreen'
import SettingsScreen from './SettingsScreen'
import CalibrationScreen from './CalibrationScreen'
import GameScreenPlaceholder from './GameScreenPlaceholder'
import LevelCompleteScreen from './LevelCompleteScreen'
import LevelFailedScreen from './LevelFailedScreen'
import GameOverScreen from './GameOverScreen'
import VictoryScreen from './VictoryScreen'
import GoodbyeScreen from './GoodbyeScreen'

interface CurrentScreenProps {
  onRunEnding: () => void
  session: number
  onRetryPaused: () => void
  preferences: Preferences
  onPreferences: (value: Preferences) => void
  selectedLevel: number
  onSelectLevel: (level: number) => void
  voiceEnabled: boolean
  onVoiceEnabled: (enabled: boolean) => void
  voiceStatus: string
  voiceHeard: string
  micLevel: number
  screen: GameScreen
  onNavigate: NavigateFn
  /** The score of the game that last ended; shown on the Game Over screen. */
  finalScore: number
  /** The level to play on the Game screen (1 to 5) and the lives it starts with. */
  level: number
  startingLives: number
  /** Called by the Game screen once when its level ends in any way. */
  onLevelEnd: (result: LevelResult) => void
  /** How the level that just ended went; shown on Level Complete and Level Failed. */
  lastResult: LevelResult | null
  onNextLevel: () => void
  onRetryLevel: () => void
}

/**
 * Picks the component for the current screen name.
 * The `default` branch makes TypeScript report an error if a screen is added
 * to GAME_SCREENS but not handled here.
 */
export default function CurrentScreen({
  onRunEnding, session, onRetryPaused, preferences, onPreferences, selectedLevel, onSelectLevel, voiceEnabled, onVoiceEnabled, voiceStatus, voiceHeard, micLevel,
  screen,
  onNavigate,
  finalScore,
  level,
  startingLives,
  onLevelEnd,
  lastResult,
  onNextLevel,
  onRetryLevel,
}: CurrentScreenProps) {
  switch (screen) {
    case 'start':
      return <StartScreen onNavigate={onNavigate} preferences={preferences} selectedLevel={selectedLevel} onSelectLevel={onSelectLevel} />
    case 'instructions':
      return <InstructionsScreen onNavigate={onNavigate} />
    case 'settings':
      return <SettingsScreen onNavigate={onNavigate} preferences={preferences} onPreferences={onPreferences} voiceEnabled={voiceEnabled} onVoiceEnabled={onVoiceEnabled} voiceStatus={voiceStatus} voiceHeard={voiceHeard} micLevel={micLevel} />
    case 'calibration':
      return <CalibrationScreen onNavigate={onNavigate} />
    // 'game' and 'pause' render the SAME component in the same place, so React keeps it mounted
    // when the player pauses and resumes: the game (score, lives, sushi, bonus) is frozen, not
    // restarted. Any other screen unmounts it, so the next game starts fresh.
    case 'game':
    case 'pause':
      return (
        <GameScreenPlaceholder onRunEnding={onRunEnding} key={session} onRetry={onRetryPaused}
          paused={screen === 'pause'}
          onNavigate={onNavigate}
          level={level}
          startingLives={startingLives}
          onLevelEnd={onLevelEnd}
        />
      )
    case 'levelComplete':
      return <LevelCompleteScreen onNavigate={onNavigate} result={lastResult} onNextLevel={onNextLevel} />
    case 'levelFailed':
      return <LevelFailedScreen onNavigate={onNavigate} result={lastResult} onRetryLevel={onRetryLevel} />
    case 'gameOver':
      return <GameOverScreen onNavigate={onNavigate} finalScore={finalScore} level={lastResult?.level ?? 1} />
    case 'victory':
      return <VictoryScreen onNavigate={onNavigate} />
    case 'goodbye':
      return <GoodbyeScreen onNavigate={onNavigate} />
    default: {
      const unhandled: never = screen
      return unhandled
    }
  }
}
