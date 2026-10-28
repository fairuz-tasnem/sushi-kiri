import type { ScreenProps } from '../game/gameScreen'
import type { Preferences } from '../game/preferences'
import Button from '../components/Button'
import ScreenFrame from '../components/ScreenFrame'
import { assetManifest } from '../game/assetManifest'
interface Props extends ScreenProps {
  preferences: Preferences; onPreferences: (value: Preferences) => void;
  voiceEnabled: boolean; onVoiceEnabled: (value: boolean) => void; voiceStatus: string; voiceHeard: string; micLevel: number
}
export default function SettingsScreen({ onNavigate, preferences, onPreferences, voiceEnabled, onVoiceEnabled, voiceStatus, voiceHeard, micLevel }: Props) {
  const hasAudio = assetManifest.audio.some(entry => entry.file)
  return <ScreenFrame title="Settings" actions={<Button onClick={() => onNavigate('start')}>Main menu</Button>}>
    <label>Music volume: {Math.round(preferences.music * 100)}%<input type="range" min="0" max="1" step="0.05" value={preferences.music} onChange={e => onPreferences({ ...preferences, music: Number(e.target.value) })} /></label>
    <label>Sound effects: {Math.round(preferences.effects * 100)}%<input type="range" min="0" max="1" step="0.05" value={preferences.effects} onChange={e => onPreferences({ ...preferences, effects: Number(e.target.value) })} /></label>
    {!hasAudio && <p className="note">No music or sound files were supplied. These saved volumes will apply when audio is added.</p>}
    <p>Say “play”, “pause”, “resume”, or “exit”. “Kiri” before a command also works. Your browser may send audio to its speech service. Support varies by browser.</p>
    <Button onClick={() => onVoiceEnabled(!voiceEnabled)}>{voiceEnabled ? 'Disable voice controls' : 'Enable voice controls'}</Button>
    <p role="status">{voiceStatus}</p>
    {voiceEnabled && <div className="mic-check"><label>Microphone input<meter min="0" max="1" value={micLevel} aria-label="Microphone input level" /></label><p>{voiceHeard ? `Heard: “${voiceHeard}”` : 'Say “play” to test. Your transcript will appear here.'}</p><small>If the meter moves but no words appear, microphone input works but the speech service has not returned a transcript.</small></div>}
    {!voiceEnabled && preferences.voice && <p>Voice was previously enabled. Enable it again to start the microphone for this session.</p>}
  </ScreenFrame>
}
