/**
 * Sound effects (Task 4): play a sound by its id from the asset manifest, and stay silent and
 * safe whenever that is not possible. Nothing in the game depends on a sound playing.
 *
 * The cases, all of which end quietly (no crash, no error in the player's face):
 *   - the id is not in the manifest, or its `file` is null (no sound added yet)   -> nothing
 *   - there is no Audio support (a non-browser environment)                        -> nothing
 *   - the file is listed but missing or not a playable sound (a 404, a bad file)  -> the
 *     browser rejects play(); we catch it and, in development builds only, print ONE warning
 *     per sound so a wrong file name is easy to spot
 *   - the browser blocks sound until the page has been used (autoplay rules)       -> same
 *
 * Sounds only start after the player has already clicked buttons to get to the Game screen, so
 * browsers normally allow them. There are no volume controls yet (a later step).
 *
 * To add a sound: put the file in public/game-assets/audio/ and set `file` on its entry in
 * the manifest's `audio` list. No code change is needed.
 */

import { assetManifest, getAssetUrl } from './assetManifest'

/** The ids of the sound effects the game plays, as listed in the manifest's `audio` entries. */
export type SoundId = 'wasabi-hit'

/** Sounds that already produced a development warning, so each is reported once, not 60 times a second. */
const warned = new Set<string>()

export function playSound(id: SoundId): void {
  const entry = assetManifest.audio.find((asset) => asset.id === id && asset.kind === 'audio')
  if (!entry) return
  const url = getAssetUrl('audio', id)
  if (!url) return // no file yet: silence is the expected result
  if (typeof Audio === 'undefined') return

  const warnOnce = (reason: unknown) => {
    if (!import.meta.env.DEV || warned.has(id)) return
    warned.add(id)
    console.warn(`Sound "${id}" (${url}) could not be played:`, reason)
  }

  try {
    const sound = new Audio(url)
    // play() returns a promise in browsers; it rejects if the file is missing or sound is blocked.
    void Promise.resolve(sound.play()).catch(warnOnce)
  } catch (error) {
    warnOnce(error)
  }
}
