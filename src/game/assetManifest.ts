/** Supplied artwork/audio and original synthesized ambience; all paths resolve locally. */
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
  sushi: [
    { id: 'salmon-nigiri', kind: 'image', file: 'SalmonNigiri1.png', label: 'SALMON' },
    { id: 'maki-roll', kind: 'image', file: 'SushiRollSalmon1.png', label: 'MAKI' },
    { id: 'egg-nigiri', kind: 'image', file: 'EggNigiri1.png', label: 'EGG' },
    { id: 'shrimp-nigiri', kind: 'image', file: 'ShrimpNigirii1.png', label: 'SHRIMP' },
  ],
  powerups: [{ id: 'soy-sauce', kind: 'image', file: 'SoySauce1.png', label: 'SOY' }],
  hazards: [{ id: 'wasabi', kind: 'image', file: 'Wasabi1.png', label: 'WASABI' }],
  ui: [{ id: 'logo', kind: 'image', file: 'Logo1.png' }, { id: 'phiruz', kind: 'image', file: 'phiruz_polished.png' }],
  backgrounds: [{ id: 'backgrounds-placeholder', kind: 'image', file: null }],
  effects: [{ id: 'effects-placeholder', kind: 'image', file: null }],
  audio: ['bgm-menu', 'bgm-game', 'sushi-cut', 'soy-bonus', 'wasabi-hit', 'level-complete', 'game-over', 'game-start', 'exit', 'ui-click'].map(id => ({ id, kind: 'audio', file: ({ 'wasabi-hit': 'wasabi-fail.wav', 'bgm-game': 'game-jazz.mp3', 'sushi-cut': 'rubber-pop.mp3', 'level-complete': 'reward-reveal.ogg', 'game-over': 'game-descent.mp3' } as Record<string, string>)[id] ?? `${id}.ogg` })),
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
