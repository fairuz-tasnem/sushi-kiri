import type { GameScreen } from './gameScreen'
export type Command = 'play' | 'pause' | 'resume' | 'exit'
export function commandDestination(command: Command, screen: GameScreen): GameScreen | null {
  if (command === 'play' && screen === 'start') return 'game'
  if (command === 'pause' && screen === 'game') return 'pause'
  if (command === 'resume' && screen === 'pause') return 'game'
  if (command === 'exit') {
    if (screen === 'start') return 'goodbye'
    if (screen !== 'goodbye') return 'start'
  }
  return null
}
export function parseVoice(text: string): Command | null {
  const match = /^(?:kiri[ ,]+)?(play|pause|resume|exit)[.!?]?$/.exec(text.trim().toLowerCase().replace(/\s+/g, ' '))
  return match ? match[1] as Command : null
}
