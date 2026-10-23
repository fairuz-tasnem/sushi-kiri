/**
 * Central manifest for future image and audio assets.
 *
 * Day 1 ships NO real asset files. Every entry below is a placeholder whose
 * `file` is `null`, meaning "no file has been added yet".
 *
 * Where the files go
 *   Put real files in public/game-assets/<category>/ (the folders already
 *   exist). Vite serves everything in public/ as-is, so a file at
 *   public/game-assets/sushi/example.png is reachable at
 *   `${import.meta.env.BASE_URL}game-assets/sushi/example.png`.
 *
 * How to add an asset later
 *   1. Drop the file into the matching category folder.
 *   2. Replace the placeholder entry (or add a new entry) and set `file`
 *      to the file name only, for example:
 *         { id: 'example', kind: 'image', file: 'example.png' }
 *   3. In code, call getAssetUrl('sushi', 'example') to get its URL.
 */

export const ASSET_CATEGORIES = [
  'sushi',
  'powerups',
  'hazards',
  'ui',
  'backgrounds',
  'effects',
  'audio',
] as const

export type AssetCategory = (typeof ASSET_CATEGORIES)[number]

export type AssetKind = 'image' | 'audio'

export interface AssetEntry {
  /** Short name used in code to look the asset up. Unique within its category. */
  id: string
  kind: AssetKind
  /** File name inside the category folder, or null while no file exists yet. */
  file: string | null
  /** Short on-screen name, used for the labelled placeholder drawn while `file` is null. */
  label?: string
}

export type AssetManifest = Record<AssetCategory, readonly AssetEntry[]>

export const assetManifest: AssetManifest = {
  // One entry per sushi type. The game spawns every 'image' entry listed here (see
  // getSushiTypes in sushi.ts), so adding or removing a type is a change to this list only.
  // `file` stays null until the animator delivers the art; until then the game draws a
  // labelled placeholder using `label`.
  sushi: [
    { id: 'salmon-nigiri', kind: 'image', file: null, label: 'SALMON' },
    { id: 'maki-roll', kind: 'image', file: null, label: 'MAKI' },
    { id: 'egg-nigiri', kind: 'image', file: null, label: 'EGG' },
    { id: 'shrimp-nigiri', kind: 'image', file: null, label: 'SHRIMP' },
  ],
  // The soy sauce bottle. Like the sushi, `file` stays null until the art exists, and a labelled
  // placeholder bottle is drawn instead. (Read by getSoySauceType in sushi.ts.)
  powerups: [{ id: 'soy-sauce', kind: 'image', file: null, label: 'SOY' }],
  // The wasabi hazard (read by getWasabiType in sushi.ts). `file` stays null until the art exists.
  hazards: [{ id: 'wasabi', kind: 'image', file: null, label: 'WASABI' }],
  ui: [{ id: 'ui-placeholder', kind: 'image', file: null }],
  backgrounds: [{ id: 'backgrounds-placeholder', kind: 'image', file: null }],
  effects: [{ id: 'effects-placeholder', kind: 'image', file: null }],
  // Sound effects (played by playSound in audio.ts). A null `file` means "no sound yet": the
  // game stays silent for that id and nothing breaks.
  audio: [{ id: 'wasabi-hit', kind: 'audio', file: null }],
}

/** Folder (relative to the site root) that holds all game assets. */
const ASSET_ROOT = 'game-assets'

/**
 * Returns the URL for an asset, or null if the entry does not exist or its
 * file has not been added yet. Callers must handle null.
 */
export function getAssetUrl(category: AssetCategory, id: string): string | null {
  const entry = assetManifest[category].find((asset) => asset.id === id)
  if (!entry || entry.file === null) {
    return null
  }
  return `${import.meta.env.BASE_URL}${ASSET_ROOT}/${category}/${entry.file}`
}
