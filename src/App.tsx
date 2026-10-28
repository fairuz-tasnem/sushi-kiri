import { getAssetUrl } from './game/assetManifest'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameScreen } from './game/gameScreen'
import { gameConfig } from './game/gameConfig'
import { newRun, nextRunSetup } from './game/levelProgress'
import type { LevelResult, RunSetup } from './game/levelProgress'
import { commandDestination } from './game/commands'
import type { Command } from './game/commands'
import { readPreferences, savePreferences } from './game/preferences'
import { configureAudio, setMusicScreen, unlockAudio, stopAudio, playSound } from './game/audio'
import { CameraContext } from './camera/CameraContext'
import { useCameraStream } from './camera/useCameraStream'
import CurrentScreen from './screens/CurrentScreen'
import { HandTrackingContext } from './vision/HandTrackingContext'
import { useHandTracker } from './vision/useHandTracker'
import { useGestureCommands } from './vision/useGestureCommands'
import { useVoice } from './vision/useVoice'
import BrandLogo from './components/BrandLogo'
import WebcamPreview from './components/WebcamPreview'
import HandCursor from './components/HandCursor'
import GestureHint from './components/GestureHint'

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('start')
  const ending = useRef(false)
  const screenRef = useRef<GameScreen>('start')
  const lastTransition = useRef(-Infinity)
  const [preferences, setPreferences] = useState(readPreferences)
  const [saveFailed, setSaveFailed] = useState(false)
  // Remember the preference, but require a fresh explicit activation after each page load.
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [run, setRun] = useState<RunSetup>(() => newRun(gameConfig.startingLives))
  const [lastResult, setLastResult] = useState<LevelResult | null>(null)
  const [session, setSession] = useState(0)
  const [selectedLevel, setSelectedLevel] = useState(1)
  const camera = useCameraStream()
  const [video, setVideo] = useState<HTMLVideoElement | null>(null)
  const tracking = useHandTracker(video, camera.status === 'ready')
  const go = useCallback((next: GameScreen) => {
    ending.current = false
    screenRef.current = next; setScreen(next); lastTransition.current = performance.now()
  }, [])
  const begin = useCallback(() => {
    playSound('game-start')
    setSession(n => n + 1)
    go((tracking.inputMode === 'mouse' || camera.status === 'ready' && tracking.status === 'tracking') ? 'game' : 'calibration')
  }, [go, camera.status, tracking.status, tracking.inputMode])
  const dispatch = useCallback((command: Command) => {
    if (performance.now() - lastTransition.current < 350) return false
    if (ending.current && command !== 'exit') return false
    const from = screenRef.current
    const next = commandDestination(command, from)
    if (!next) return false
    if (command === 'play') {
      setRun({ level: selectedLevel, lives: 3 }); begin()
    } else go(next)
    return true
  }, [begin, go, selectedLevel])
  const navigate = useCallback((next: GameScreen) => {
    const from = screenRef.current
    if (next === 'pause') { dispatch('pause'); return }
    if (next === 'game') {
      if (from === 'pause') { dispatch('resume'); return }
      if (from === 'start') { dispatch('play'); return }
      if (from === 'calibration' && tracking.inputMode !== 'mouse' && tracking.status !== 'tracking') return
      if (from === 'gameOver' || from === 'victory') setRun(newRun(3))
      if (from === 'calibration' || from === 'gameOver' || from === 'victory') begin()
      return
    }
    if (next === 'start' || next === 'goodbye') {
      if (from === 'goodbye' && next === 'start') go('start')
      else dispatch('exit')
      return
    }
    go(next)
  }, [begin, dispatch, go, tracking.status, tracking.inputMode])
  const gestureHint = useGestureCommands(screen, navigate, tracking.subscribeGestureCommands)
  const voice = useVoice(voiceEnabled, dispatch)
  const handleLevelEnd = useCallback((result: LevelResult) => {
    if (screenRef.current !== 'game') return
    setLastResult(result); setFinalScore(result.score)
    setRun(nextRunSetup(result, 3))
    setPreferences(p => ({ ...p, unlocked: Math.max(p.unlocked, result.outcome === 'complete' ? result.level + 1 : result.level),
      best: { ...p.best, [result.level]: Math.max(p.best[result.level] ?? 0, result.score) } }))
    if (result.outcome === 'failed') playSound('game-over')
    go(({ complete: 'levelComplete', victory: 'victory', failed: 'levelFailed', gameOver: 'gameOver' } as const)[result.outcome])
  }, [go])
  const startPreparedLevel = useCallback(() => {
    if (screenRef.current !== 'levelComplete' && screenRef.current !== 'levelFailed') return
    begin()
  }, [begin])
  const retryPausedLevel = useCallback(() => {
    if (screenRef.current !== 'pause') return
    setRun(r => ({ ...r, lives: 3 })); begin()
  }, [begin])
  useEffect(() => {
    if ((screen === 'calibration' || screen === 'game') && camera.status === 'idle') void camera.start()

  }, [screen, camera.status, camera.start, camera.stop])
  useEffect(() => {
    configureAudio(preferences.music * (voiceEnabled ? 0.15 : 1), preferences.effects * (voiceEnabled ? 0.5 : 1))
    setSaveFailed(!savePreferences(preferences))
  }, [preferences, voiceEnabled])
  useEffect(() => {
    setMusicScreen(screen)
    if (screen === 'goodbye') {
      camera.stop(); setVoiceEnabled(false); stopAudio(); playSound('exit')
    }
  }, [screen, camera.stop])
  useEffect(() => {
    const unlock = () => unlockAudio()
    const key = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || (e.target as HTMLElement).closest('input,select,textarea,[contenteditable=true]')) return
      if (e.key === 'Escape') { e.preventDefault(); dispatch('exit') }
      else if (e.key.toLowerCase() === 'p') { e.preventDefault(); dispatch(screenRef.current === 'pause' ? 'resume' : 'pause') }
      else if ((e.key === 'Enter' || e.key === ' ') && !(e.target as HTMLElement).closest('button,a')) {
        e.preventDefault(); dispatch(screenRef.current === 'pause' ? 'resume' : 'play')
      }
    }
    const hidden = () => { if (document.hidden && screenRef.current === 'game' && !ending.current) go('pause') }
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock)
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hidden) }
  }, [dispatch, go])
  useEffect(() => () => stopAudio(), [])
  const cameraBackground = screen === 'game' && camera.status === 'ready'
  return <CameraContext.Provider value={camera}><HandTrackingContext.Provider value={tracking}>
    <div data-screen={screen} data-input-mode={tracking.inputMode} className={cameraBackground ? 'app app--playing' : 'app'}>
      <div className="tray"><main className="tray__main"><div className={screen === 'start' || screen === 'game' ? 'tray__inner' : 'tray__inner secondary-layout'}>
        {screen !== 'start' && screen !== 'game' && <div className="secondary-brand"><BrandLogo /></div>}
        <CurrentScreen onRunEnding={() => { ending.current = true }} screen={screen} onNavigate={navigate} finalScore={finalScore} level={run.level} startingLives={run.lives}
          onLevelEnd={handleLevelEnd} lastResult={lastResult} onNextLevel={startPreparedLevel} onRetryLevel={startPreparedLevel}
          onRetryPaused={retryPausedLevel} session={session} preferences={preferences} onPreferences={setPreferences}
          selectedLevel={selectedLevel} onSelectLevel={setSelectedLevel} voiceEnabled={voiceEnabled}
          onVoiceEnabled={enabled => { setVoiceEnabled(enabled); setPreferences(p => ({ ...p, voice: enabled })) }} voiceStatus={voice.status} voiceHeard={voice.heard} micLevel={voice.micLevel} />
      </div></main></div>
      <div className="game-border" aria-hidden="true" />
      <div className="creator-mark"><img src={getAssetUrl('ui', 'phiruz')!} alt="φruz" /></div>
      <WebcamPreview background={cameraBackground} onVideoElement={setVideo} />
      <HandCursor video={video} subscribe={tracking.subscribe} visible={screen !== 'goodbye' || tracking.inputMode === 'mouse'} playing={screen === 'game'} screen={screen} />
      <GestureHint hint={gestureHint} />
      {voiceEnabled && <div className="voice-status" role="status">{voice.status}<meter min="0" max="1" value={voice.micLevel} aria-label="Microphone input level" />{voice.heard && <span className="voice-heard">Heard: “{voice.heard}”</span>} <button onClick={() => setVoiceEnabled(false)}>Turn voice off</button></div>}
      {saveFailed && <p className="save-warning" role="status">Browser storage unavailable. Progress lasts for this session only.</p>}
    </div>
  </HandTrackingContext.Provider></CameraContext.Provider>
}
