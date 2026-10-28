import { useEffect, useRef, useState } from 'react'
import { parseVoice } from '../game/commands'
import type { Command } from '../game/commands'

interface Result extends ArrayLike<{ transcript: string }> { isFinal: boolean }
interface Recognition {
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  lang: string
  onresult: ((e: { resultIndex: number; results: ArrayLike<Result> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
  start(): void
  abort(): void
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
export interface VoiceState { status: string; heard: string; micLevel: number }

/** Real microphone monitoring is local. Speech recognition is the browser's service. */
export function useVoice(enabled: boolean, dispatch: (command: Command) => boolean | void): VoiceState {
  const [status, setStatus] = useState('Voice off')
  const [heard, setHeard] = useState('')
  const [micLevel, setMicLevel] = useState(0)
  const action = useRef(dispatch)
  action.current = dispatch
  useEffect(() => {
    setHeard(''); setMicLevel(0)
    if (!enabled) { setStatus('Voice off'); return }
    const w = window as SpeechWindow
    const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Constructor) {
      setStatus('Speech recognition is unavailable in this browser. Try a browser with Web Speech support.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Microphone access needs localhost or HTTPS. Open the Vite address, not the HTML file.')
      return
    }
    let disposed = false
    let failed = false
    let lastCommand = -Infinity
    let restart = 0
    let watchdog = 0
    let meterTimer = 0
    let consumed = -1
    let stream: MediaStream | null = null
    let context: AudioContext | null = null
    let recognition: Recognition | null = null
    const stopMicrophone = () => {
      clearInterval(meterTimer)
      stream?.getTracks().forEach(track => track.stop())
      stream = null
      if (context && context.state !== 'closed') void context.close().catch(() => {})
      context = null
      if (!disposed) setMicLevel(0)
    }
    const fail = (message: string) => {
      if (disposed || failed) return
      failed = true
      clearTimeout(watchdog); clearTimeout(restart)
      setStatus(message)
      recognition?.abort()
      stopMicrophone()
    }
    const start = () => {
      if (disposed || failed || !recognition) return
      consumed = -1
      setStatus('Microphone connected. Starting speech recognition…')
      watchdog = window.setTimeout(() => fail('The speech service did not start. Check your connection, then turn voice off and on.'), 10000)
      try { recognition.start() }
      catch { fail('Speech recognition could not start. Turn voice off and on to retry.') }
    }
    const initialize = async () => {
      setStatus('Allow microphone access when your browser asks.')
      try {
        const input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false })
        if (disposed) { input.getTracks().forEach(track => track.stop()); return }
        stream = input
        input.getAudioTracks().forEach(track => { track.onended = () => fail('Microphone disconnected. Reconnect it, then enable voice again.') })
        // Meter reports the actual audio signal, never a simulated listening animation.
        context = new AudioContext()
        await context.resume()
        if (disposed) { stopMicrophone(); return }
        const analyser = context.createAnalyser()
        analyser.fftSize = 512
        context.createMediaStreamSource(input).connect(analyser)
        const samples = new Uint8Array(analyser.fftSize)
        meterTimer = window.setInterval(() => {
          analyser.getByteTimeDomainData(samples)
          let energy = 0
          for (const sample of samples) energy += ((sample - 128) / 128) ** 2
          setMicLevel(Math.min(1, Math.sqrt(energy / samples.length) * 5))
        }, 100)
        recognition = new Constructor()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.maxAlternatives = 3
        recognition.lang = 'en-US'
        recognition.onstart = () => {
          clearTimeout(watchdog)
          if (!disposed && !failed) setStatus('Listening — say play, pause, resume, or exit.')
        }
        recognition.onresult = event => {
          if (disposed || failed) return
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i]
            if (i <= consumed) continue
            setHeard(result[0]?.transcript ?? '')
            if (!result.isFinal) continue
            consumed = i
            // Consider alternate transcripts, but only accept a complete supported phrase.
            let command: Command | null = null
            for (let j = 0; j < result.length; j++) {
              command = parseVoice(result[j].transcript)
              if (command) break
            }
            if (!command) { setStatus('No command matched. Try just “pause” or “resume”.'); continue }
            const now = performance.now()
            if (now - lastCommand < 1500) { setStatus('Wait a moment before the next voice command.'); continue }
            lastCommand = now
            const used = action.current(command)
            setStatus(used === false ? `“${command}” is not available on this screen.` : `Heard “${command}”. Listening for your next command.`)
          }
        }
        recognition.onerror = event => {
          if (disposed || failed) return
          if (event.error === 'no-speech') { setStatus('No speech caught. Speak near the microphone.'); return }
          const messages: Record<string, string> = {
            'not-allowed': 'Microphone permission denied. Allow the microphone in site settings, then enable voice again.',
            'service-not-allowed': 'Your browser has blocked its speech service. Check browser settings or try another supported browser.',
            'audio-capture': 'No microphone input. Check your selected input device and reconnect it.',
            network: 'The speech service is unreachable. Check your connection; microphone access alone is not enough.',
          }
          fail(messages[event.error] ?? `Speech recognition stopped (${event.error}). Turn voice off and on to retry.`)
        }
        recognition.onend = () => {
          clearTimeout(watchdog)
          if (!disposed && !failed) restart = window.setTimeout(start, 700)
        }
        start()
      } catch (error) {
        const denied = error instanceof DOMException && error.name === 'NotAllowedError'
        fail(denied ? 'Microphone permission denied. Allow the microphone in site settings, then enable voice again.' : 'Microphone unavailable. Check the input device and browser permission, then retry.')
      }
    }
    void initialize()
    return () => {
      disposed = true
      clearTimeout(restart); clearTimeout(watchdog)
      if (recognition) {
        recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.onstart = null
        recognition.abort()
      }
      stopMicrophone()
    }
  }, [enabled])
  return { status, heard, micLevel }
}
