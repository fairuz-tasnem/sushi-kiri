import { getAssetUrl } from './assetManifest'
export type SoundId = 'sushi-cut' | 'soy-bonus' | 'wasabi-hit' | 'level-complete' | 'game-over' | 'game-start' | 'exit' | 'ui-click'
let musicVolume = .4
let effectVolume = .7
let unlocked = false
let music: HTMLAudioElement | null = null
let currentUrl: string | null = null
let screen = 'start'
let generation = 0
let pending = false
let popVariant = 0
const effects = new Map<string, HTMLAudioElement>()
const fades = new Map<HTMLAudioElement, number>()
function fade(audio: HTMLAudioElement, target: number, seconds: number, done?: () => void) {
  const previous = fades.get(audio)
  if (previous) cancelAnimationFrame(previous)
  const start = performance.now(), initial = audio.volume
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / (seconds * 1000))
    audio.volume = Math.max(0, Math.min(1, initial + (target - initial) * t))
    if (t < 1) fades.set(audio, requestAnimationFrame(step))
    else { fades.delete(audio); done?.() }
  }
  fades.set(audio, requestAnimationFrame(step))
}
function gain() { return musicVolume * (screen === 'game' ? .42 : .65) }
function play(audio: HTMLAudioElement) { void audio.play().catch(() => { /* Missing/blocked audio never blocks a transition. */ }) }
export function configureAudio(musicLevel: number, effectsLevel: number) {
  musicVolume = musicLevel; effectVolume = effectsLevel
  if (music && !pending && screen !== 'pause') fade(music, gain(), .2)
  effects.forEach((audio, id) => { if (!fades.has(audio)) audio.volume = effectVolume * (id === 'sushi-cut' ? .8 : 1) })
}
export function unlockAudio() { unlocked = true; setMusicScreen(screen) }
export function setMusicScreen(next: string) {
  screen = next
  const url = next === 'goodbye' || next === 'descent' ? null : getAssetUrl('audio', next === 'game' || next === 'pause' ? 'bgm-game' : 'bgm-menu')
  if (url !== currentUrl) {
    currentUrl = url
    const token = ++generation
    pending = true
    const replace = () => {
      if (token !== generation) return
      music?.pause(); music = url ? new Audio(url) : null
      pending = false
      if (music) { music.loop = true; music.volume = 0; if (unlocked && screen !== 'pause') { play(music); fade(music, gain(), .6) } }
    }
    if (music) fade(music, 0, next === 'descent' ? .9 : .25, replace)
    else replace()
    return
  }
  if (!music || pending) return
  if (next === 'pause') fade(music, 0, .2, () => music?.pause())
  else if (unlocked) { if (music.paused) play(music); fade(music, gain(), .2) }
}
export function playSound(id: SoundId) {
  if (!unlocked) return
  const url = getAssetUrl('audio', id)
  if (!url) return
  let sound = effects.get(id)
  if (!sound) { sound = new Audio(url); effects.set(id, sound) }
  const fading = fades.get(sound)
  if (fading) { cancelAnimationFrame(fading); fades.delete(sound) }
  sound.volume = effectVolume * (id === 'sushi-cut' ? .8 : 1)
  if (id === 'sushi-cut') sound.playbackRate = [.94, 1, 1.06][popVariant++ % 3]
  sound.currentTime = 0; play(sound)
}
export function stopSound(id: SoundId) {
  const sound = effects.get(id)
  if (sound) fade(sound, 0, .15, () => sound.pause())
}
export function stopAudio() {
  generation++; pending = false
  fades.forEach(handle => cancelAnimationFrame(handle)); fades.clear()
  music?.pause(); music = null; currentUrl = null
  effects.forEach(sound => sound.pause()); effects.clear()
}
