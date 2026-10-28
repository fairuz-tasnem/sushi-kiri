/**
 * One flying object: its state, how it is launched, how it moves, and when it is finished.
 * The object is usually a sushi, or a soy sauce bottle, or a wasabi (see SushiKind); all fly and
 * are cut the same way, which is why those are a `Sushi` whose type has another `kind`.
 * No drawing here (see renderer.ts), no slicing rules (see slicing.ts), no spawn timing
 * (see sushiSpawner.ts) and no React.
 *
 * A sushi flies like a thrown object: launched upward from just below the bottom edge,
 * slowing under gravity until it peaks, then falling back out of the bottom. It is created
 * by spawnSushi and thrown away by sushiSpawner.ts once isSushiFinished says so. Many can
 * exist at the same time; each carries everything it needs, so they never affect each other.
 *
 * Positions are in CSS pixels on the canvas (0, 0 = top-left, y grows downward);
 * speeds are in pixels per second. Sizes and gravity are worked out from the canvas
 * size at launch, so the flight looks the same in a small window and a big one.
 *
 * Every tuning number that decides HOW a sushi is thrown (peak height, sideways speed,
 * gravity, lifetimes) comes from gameConfig.ts. The few constants below only decide how
 * big it looks and how it spins.
 */

import { assetManifest } from './assetManifest'
import type { CanvasView } from './canvasView'
import type { GameConfig } from './gameConfig'

/** The sushi's radius as a fraction of the shorter canvas side, kept between the two limits. */
const RADIUS_FRACTION = 0.09
const MIN_RADIUS = 36
const MAX_RADIUS = 80

/** Slow visual spin, in radians per second; each sushi spins a little faster or slower than this. */
const SPIN_SPEED = 0.9
const SPIN_VARIATION = 0.4

/** Chance that a sushi drifts toward the middle of the screen rather than toward the nearer edge. */
const TOWARD_CENTRE_CHANCE = 0.75

/** Returns a number from 0 up to (not including) 1. Math.random in the game; a fixed sequence in tests. */
export type RandomFn = () => number

/**
 * What an object is when it is cut (scoring.ts applies the effect): 'sushi' scores points,
 * 'soySauce' starts the double-points bonus, 'wasabi' costs one life.
 */
export type SushiKind = 'sushi' | 'soySauce' | 'wasabi'

/** One kind of flying object. The lists come from the asset manifest (see getSushiTypes, getSoySauceType). */
export interface SushiType {
  /** The manifest id, for example 'salmon-nigiri'. The renderer picks the art or placeholder colour by it. */
  id: string
  /** Short name shown on the placeholder. */
  label: string
  kind: SushiKind
}

/** What a cut leaves on a sushi, so the renderer can draw it in two halves. */
export interface SushiSlice {
  /** Direction of the swipe that made the cut, in radians. The halves part at right angles to it. */
  angle: number
  /** Seconds since the cut, advanced by updateSushi. */
  age: number
}

export interface Sushi {
  type: SushiType
  /** Centre of the sushi. */
  x: number
  y: number
  /** Velocity in pixels per second. */
  vx: number
  vy: number
  /** Downward acceleration for this flight, fixed at launch. */
  gravity: number
  /** Radius in pixels. The drawing is sized from it, and slicing (slicing.ts) uses it as the collision circle. */
  radius: number
  /** Current rotation and spin speed, in radians. */
  angle: number
  spin: number
  /** Seconds since it was launched, advanced by updateSushi. */
  age: number
  /**
   * null while the sushi is whole. Set once, by the swipe that cuts it, and never cleared:
   * this is what stops one sushi from being cut twice. A cut sushi is removed after a short
   * time (see isSushiFinished), and the next one is a different object.
   */
  slice: SushiSlice | null
  /**
   * True once this object's effect (its points, the soy sauce bonus, or the lost life) has been given. Only
   * scoring.ts sets it. It is a second, independent guard next to `slice`: even if some future
   * code path cut an object twice, its effect could still only be applied once.
   */
  claimed: boolean
}

/**
 * The sushi types the game can spawn: every 'image' entry in the manifest's sushi list.
 * Returns an empty list if the manifest has none, and the spawner then spawns nothing.
 */
export function getSushiTypes(): readonly SushiType[] {
  return assetManifest.sushi
    .filter((entry) => entry.kind === 'image')
    .map((entry) => ({ id: entry.id, label: entry.label ?? entry.id, kind: 'sushi' as const }))
}

/** The manifest ids of the two special objects, in the `powerups` and `hazards` lists. */
const SOY_SAUCE_ID = 'soy-sauce'
const WASABI_ID = 'wasabi'

/** The soy sauce bottle's type, or null if the manifest has no such entry (then none is ever spawned). */
export function getSoySauceType(): SushiType | null {
  const entry = assetManifest.powerups.find((item) => item.id === SOY_SAUCE_ID && item.kind === 'image')
  return entry ? { id: entry.id, label: entry.label ?? entry.id, kind: 'soySauce' } : null
}

/** The wasabi's type, or null if the manifest has no such entry (then no wasabi is ever spawned). */
export function getWasabiType(): SushiType | null {
  const entry = assetManifest.hazards.find((item) => item.id === WASABI_ID && item.kind === 'image')
  return entry ? { id: entry.id, label: entry.label ?? entry.id, kind: 'wasabi' } : null
}

/**
 * Creates a new whole sushi just below the bottom edge and throws it up and across the canvas.
 *
 * What is random (all within the ranges in `config`): where along the bottom it starts, how
 * high it peaks, how fast it drifts sideways, and its spin. What is fixed: it always starts
 * just out of sight, and it never drifts off the left or right edge before it has landed.
 */
export function spawnSushi(
  type: SushiType,
  view: CanvasView,
  config: GameConfig,
  random: RandomFn,
): Sushi {
  const radius = clamp(Math.min(view.width, view.height) * RADIUS_FRACTION, MIN_RADIUS, MAX_RADIUS)
  const gravity = view.height * config.gravityPerHeight

  // Start with the sushi's top edge level with the bottom of the canvas: just out of sight.
  const startY = view.height + radius
  const apexY = view.height * lerp(config.apexFromTop, random())

  // Basic physics: to rise by `riseDistance` and stop, the launch speed must be sqrt(2 * g * distance).
  const launchSpeed = Math.sqrt(2 * gravity * Math.max(0, startY - apexY))
  // Up and back down to the start height takes 2 * speed / gravity seconds.
  const flightSeconds = (2 * launchSpeed) / gravity

  // Anywhere along the bottom, staying clear of both side edges.
  const margin = Math.max(radius * 1.5, view.width * 0.1)
  const span = Math.max(0, view.width - margin * 2)
  const x = span > 0 ? margin + random() * span : view.width / 2

  // Mostly drift toward the middle, so the screen does not empty out toward its edges.
  const towardCentre: 1 | -1 = x < view.width / 2 ? 1 : -1
  const direction = random() < TOWARD_CENTRE_CHANCE ? towardCentre : -towardCentre

  // The chosen sideways speed, but never more than reaches the margin by the end of the flight.
  const room = direction === 1 ? view.width - margin - x : x - margin
  const wantedSpeed = view.width * lerp(config.horizontalSpeedWidths, random())
  const speed = flightSeconds > 0 ? Math.min(wantedSpeed, Math.max(0, room) / flightSeconds) : 0

  const spinSign = random() < 0.5 ? -1 : 1
  const spin = spinSign * SPIN_SPEED * (1 + (random() * 2 - 1) * SPIN_VARIATION)

  return {
    type,
    x,
    y: startY,
    vx: direction * speed,
    vy: -launchSpeed,
    gravity,
    radius,
    angle: random() * Math.PI * 2,
    spin,
    age: 0,
    slice: null,
    claimed: false,
  }
}

/** Moves the sushi for one frame. `deltaSeconds` comes from the game loop. */
export function updateSushi(sushi: Sushi, deltaSeconds: number): void {
  // Distance = speed * time + half * gravity * time squared. This is exact for constant
  // gravity, so the flight is the same on a 30 Hz and a 144 Hz screen. (Adding gravity
  // to the speed first, then moving, is the common shortcut but peaks lower on slow frames.)
  sushi.y += sushi.vy * deltaSeconds + 0.5 * sushi.gravity * deltaSeconds * deltaSeconds
  sushi.vy += sushi.gravity * deltaSeconds
  sushi.x += sushi.vx * deltaSeconds
  sushi.angle += sushi.spin * deltaSeconds
  sushi.age += deltaSeconds
  if (sushi.slice) sushi.slice.age += deltaSeconds
}

/**
 * True when this sushi should be removed. Any ONE of these is enough:
 *   - it has been alive longer than the lifetime limit (a safety net, see gameConfig.ts)
 *   - it was cut and its pieces have been visible for long enough
 *   - it is falling and completely below the bottom edge
 *   - it is completely outside a side edge and still moving away from the screen
 */
export function isSushiFinished(sushi: Sushi, view: CanvasView, config: GameConfig): boolean {
  if (sushi.age > config.maxObjectLifetimeSeconds) return true
  if (sushi.slice && sushi.slice.age > config.slicedPieceLifetimeSeconds) return true
  if (sushi.vy > 0 && sushi.y - sushi.radius > view.height) return true
  if (sushi.x + sushi.radius < 0 && sushi.vx <= 0) return true
  if (sushi.x - sushi.radius > view.width && sushi.vx >= 0) return true
  return false
}

/** A value from a { min, max } range: `t` = 0 gives min, `t` = 1 gives max. */
function lerp(range: { min: number; max: number }, t: number): number {
  return range.min + (range.max - range.min) * t
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
