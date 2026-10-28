export interface Preferences { music: number; effects: number; voice: boolean; unlocked: number; best: Record<string, number> }
export const defaults: Preferences = { music: 0.4, effects: 0.7, voice: false, unlocked: 1, best: {} }
export function readPreferences(): Preferences {
  try {
    const data = JSON.parse(localStorage.getItem('sushi-kiri') ?? '{}')
    const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback
    const best: Record<string, number> = {}
    for (let i = 1; i <= 5; i++) if (Number.isFinite(data.best?.[i]) && data.best[i] >= 0) best[i] = data.best[i]
    return { music: volume(data.music, defaults.music), effects: volume(data.effects, defaults.effects), voice: data.voice === true,
      unlocked: Number.isInteger(data.unlocked) ? Math.max(1, Math.min(5, data.unlocked)) : 1, best }
  } catch { return { ...defaults, best: {} } }
}
export function savePreferences(value: Preferences): boolean {
  try { localStorage.setItem('sushi-kiri', JSON.stringify(value)); return true } catch { return false }
}
