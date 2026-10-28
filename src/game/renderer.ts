import { assetManifest, getAssetUrl } from './assetManifest'

/**
 * Drawing for the Playing screen. It only READS game state and paints it:
 * nothing here moves anything or decides anything.
 *
 * The canvas is transparent and cleared every frame, so the live camera video behind
 * it shows through everywhere except where something is drawn.
 */

import type { CanvasView } from './canvasView'
import { gameConfig } from './gameConfig'
import { POPUP_LIFETIME_SECONDS, TRAIL_LIFETIME_SECONDS } from './slicing'
import type { ScorePopup, TrailPoint } from './slicing'
import type { Sushi, SushiSlice } from './sushi'

/** Colours for the placeholder sushi, and for the fingertip trail and slice effects drawn with it. */
export interface PlaceholderColors {
  rice: string
  /** The default topping colour, used for a sushi type that has no entry in `toppings`. */
  topping: string
  /** Topping colour per sushi type id, so the types can be told apart before real art exists. */
  toppings: Readonly<Record<string, string>>
  outline: string
  labelText: string
  labelHalo: string
  /** The fingertip trail: a bright core, and a darker edge so it also shows on a bright picture. */
  trail: string
  trailEdge: string
  /** The flash drawn along a cut. */
  flash: string
  /** The "+10" popup text (its halo is labelHalo). */
  popup: string
  /** The placeholder soy sauce bottle: its body and its cap. */
  soyBody: string
  soyCap: string
  /** The placeholder wasabi: the mound and its lighter highlight. */
  wasabi: string
  wasabiLight: string
  /** Everything that means "you lost a life": the "-1 life" popup, the warning ring, the edge frame. */
  penalty: string
  /** A life that is left, in the lives row. */
  heart: string
}

/** The short-lived things drawn on top of the sushi. The arrays are read-only here. */
export interface FrameEffects {
  trail: readonly TrailPoint[]
  popups: readonly ScorePopup[]
}

/** Placeholder topping colour per sushi type id: a CSS token name, and the colour to use if it is missing. */
const PLACEHOLDER_TOPPINGS: Readonly<Record<string, readonly [token: string, fallback: string]>> = {
  'salmon-nigiri': ['--color-pink', '#d9a9a1'],
  'maki-roll': ['--color-olive-soft', '#545d3a'],
  'egg-nigiri': ['--color-sage', '#c3cba5'],
  'shrimp-nigiri': ['--color-terracotta', '#a84a28'],
}

/**
 * What the HUD badge needs. GameCanvas fills it from the score state each frame (the same object
 * every time, so nothing is allocated per frame); the renderer only reads it.
 */
export interface FrameHud {
  lostFrom: number
  lossProgress: number
  /** Lives left, and how many a game starts with (the lives row draws one heart for each). */
  lives: number
  maxLives: number
  /**
   * How strong the "you lost a life" edge frame is right now, from 0 (not drawn) to 1 (just
   * happened). GameCanvas lowers it to 0 over a fraction of a second after each wasabi hit.
   */
  penalty: number
  /** Seconds of soy sauce bonus left; the badge is drawn only while this is above 0. */
  soyRemaining: number
  /** The full bonus time, so the bar can show how much is left. */
  soyDuration: number
  /** The multiplier to show, for example 2 for "x2". */
  multiplier: number
}

/**
 * Reads the placeholder colours from the page's CSS tokens (src/styles/tokens.css) so
 * they follow the palette. If a token is missing or renamed, the fallback is used instead.
 */
export function readPlaceholderColors(): PlaceholderColors {
  const styles = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback

  const toppings: Record<string, string> = {}
  for (const [id, [name, fallback]] of Object.entries(PLACEHOLDER_TOPPINGS)) {
    toppings[id] = token(name, fallback)
  }

  return {
    rice: token('--color-cream', '#f4ecd9'),
    topping: token('--color-pink', '#d9a9a1'),
    toppings,
    outline: token('--color-olive', '#3d4528'),
    labelText: token('--color-olive', '#3d4528'),
    labelHalo: token('--color-cream', '#f4ecd9'),
    trail: token('--color-cream', '#f4ecd9'),
    trailEdge: token('--color-olive', '#3d4528'),
    flash: token('--color-cream', '#f4ecd9'),
    popup: token('--color-terracotta', '#a84a28'),
    soyBody: token('--color-brown', '#6a523d'),
    soyCap: token('--color-terracotta', '#a84a28'),
    wasabi: token('--color-moss', '#8a9668'),
    wasabiLight: token('--color-sage', '#c3cba5'),
    penalty: token('--color-terracotta-deep', '#8c3b1d'),
    heart: token('--color-terracotta', '#a84a28'),
  }
}

/** Draws one complete frame: clear, then everything that is currently in the game. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  sushi: readonly Sushi[],
  colors: PlaceholderColors,
  effects: FrameEffects,
  hud: FrameHud,
  hideSwipeEffects = false,
): void {
  // Draw in CSS pixels; the pixel ratio makes it sharp on dense screens.
  ctx.setTransform(view.pixelRatio, 0, 0, view.pixelRatio, 0, 0)
  ctx.clearRect(0, 0, view.width, view.height)

  for (const item of sushi) {
    if (item.slice) { if (!hideSwipeEffects) drawSlicedSushi(ctx, item, item.slice, colors) }
    else drawObjectPlaceholder(ctx, item, colors)
  }
  if (!hideSwipeEffects) {
    drawPenaltyFrame(ctx, view, hud, colors)
    drawScorePopups(ctx, view, effects.popups, colors)
  }
  const hudBottom = drawLives(ctx, view, hud, colors)
  drawBonusBadge(ctx, view, hud, colors, hudBottom)
  if (!hideSwipeEffects) drawTrail(ctx, effects.trail, colors) // last, so the player always sees their own fingertip path
}

/* ---------- Slice effects ---------- */

/** How long the two halves take to part, how far each half ends up from the cut (x radius), and how long the flash lasts. */
const SPLIT_SECONDS = 0.3
const SPLIT_DISTANCE = 0.45
const FLASH_SECONDS = 0.25

/**
 * Cut pieces are removed when gameConfig.slicedPieceLifetimeSeconds has passed (see sushi.ts).
 * They fade out over the last part of that time so they do not pop out of existence.
 */
const SLICED_FADE_SECONDS = 0.25

/**
 * A cut sushi: the same placeholder drawn twice, each time clipped to one side of the cut
 * line, with the two sides moved apart at right angles to it, plus a quick bright flash along
 * the cut. The cut line runs through the sushi's centre in the direction of the swipe.
 */
function drawSlicedSushi(
  ctx: CanvasRenderingContext2D,
  sushi: Sushi,
  slice: SushiSlice,
  colors: PlaceholderColors,
): void {
  const r = sushi.radius
  const split = easeOut(slice.age / SPLIT_SECONDS)
  const offset = r * SPLIT_DISTANCE * split
  const reach = r * 2.5 // big enough to cover the whole sushi
  const fadeStart = Math.max(0, gameConfig.slicedPieceLifetimeSeconds - SLICED_FADE_SECONDS)
  const pieceAlpha = 1 - clamp01((slice.age - fadeStart) / SLICED_FADE_SECONDS)

  for (const side of [-1, 1]) {
    ctx.save()
    ctx.globalAlpha = pieceAlpha
    // Work in a frame whose x axis lies along the cut, moved out to this half's position.
    ctx.translate(sushi.x, sushi.y)
    ctx.rotate(slice.angle)
    ctx.translate(0, side * offset)
    // Keep only this side of the cut (y >= 0 for side 1, y <= 0 for side -1).
    ctx.beginPath()
    ctx.rect(-reach, side === 1 ? 0 : -reach, reach * 2, reach)
    ctx.clip()
    // Undo the rotation and the sushi's own translation: the placeholder translates to the
    // sushi's position itself, so what is left is the half-offset, in the normal orientation.
    ctx.rotate(-slice.angle)
    ctx.translate(-sushi.x, -sushi.y)
    drawObjectPlaceholder(ctx, sushi, colors)
    ctx.restore()
  }

  const flash = 1 - clamp01(slice.age / FLASH_SECONDS)
  if (flash > 0) {
    ctx.save()
    ctx.translate(sushi.x, sushi.y)
    ctx.rotate(slice.angle)
    ctx.globalAlpha = flash
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.moveTo(-r * 1.6, 0)
    ctx.lineTo(r * 1.6, 0)
    ctx.strokeStyle = colors.trailEdge
    ctx.lineWidth = 4 + r * 0.14 * flash
    ctx.stroke()
    ctx.strokeStyle = colors.flash
    ctx.lineWidth = 2 + r * 0.08 * flash
    ctx.stroke()
    ctx.restore()
  }
}

/** The "+10" that rises from the cut and fades out. Pinned to where the cut happened. */
function drawScorePopups(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  popups: readonly ScorePopup[],
  colors: PlaceholderColors,
): void {
  if (popups.length === 0) return

  const fontSize = clamp(Math.min(view.width, view.height) * 0.07, 28, 60)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'miter'
  ctx.font = `800 ${fontSize}px Fraunces, serif`
  ctx.lineWidth = Math.max(4, fontSize * 0.18)

  for (const popup of popups) {
    const t = clamp01(popup.age / POPUP_LIFETIME_SECONDS)
    const y = popup.y - fontSize * 1.4 * easeOut(t)
    ctx.globalAlpha = 1 - t * t // stays solid for a while, then fades
    const text = popup.label ?? `+${popup.points}`
    ctx.strokeStyle = colors.labelHalo
    ctx.strokeText(text, popup.x, y)
    ctx.fillStyle = popup.penalty ? colors.penalty : colors.popup
    ctx.fillText(text, popup.x, y)
  }
  ctx.restore()
}

/**
 * The fingertip trail: one short line per pair of neighbouring points, newest thickest and
 * brightest, oldest thin and nearly gone. The trail only ever holds points of ONE unbroken
 * tracking sequence (slicing.ts empties it on any tracking trouble), so every line drawn here
 * joins two readings that really followed each other.
 */
function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: readonly TrailPoint[],
  colors: PlaceholderColors,
): void {
  if (trail.length < 2) return

  ctx.save()
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'
  // Two passes: ALL the dark edges first, then ALL the bright cores. Drawing edge-then-core per
  // segment would let each new edge cut a dark tick across the previous segment's core.
  const passes = [
    { color: colors.trailEdge, base: 5, extra: 9 },
    { color: colors.trail, base: 2, extra: 6 },
  ]
  for (const pass of passes) {
    ctx.strokeStyle = pass.color
    for (let i = 1; i < trail.length; i += 1) {
      const from = trail[i - 1]
      const to = trail[i]
      const life = 1 - clamp01(to.age / TRAIL_LIFETIME_SECONDS) // 1 = new, 0 = gone

      ctx.globalAlpha = life
      ctx.lineWidth = pass.base + life * pass.extra
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
  }
  ctx.restore()
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Fast at first, settling at the end: 0 -> 0, 1 -> 1. */
function easeOut(t: number): number {
  const u = 1 - clamp01(t)
  return 1 - u * u
}

/* ---------- HUD ---------- */

/**
 * The soy sauce bonus badge, top left under the lives row: "SOY SAUCE x2", the seconds left,
 * and a bar that empties as the time runs out. Drawn only while the bonus is running. The badge is solid, so it stays readable over
 * the camera picture. `top` is where it starts (the bottom of the lives row).
 */
function drawBonusBadge(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  hud: FrameHud,
  colors: PlaceholderColors,
  top: number,
): void {
  if (hud.soyRemaining <= 0) return

  const fontSize = hudFontSize(view)
  const margin = hudMargin(view)
  const padX = fontSize * 0.8
  const padY = fontSize * 0.55
  const barHeight = Math.max(5, fontSize * 0.3)
  const gap = fontSize * 0.9

  ctx.save()
  ctx.font = `800 ${fontSize}px Fraunces, serif`
  ctx.textBaseline = 'middle'

  const label = `SOY SAUCE x${hud.multiplier}`
  // The time is drawn right-aligned in a box as wide as the longest time ("5.0s"), so the
  // badge does not change width or jiggle while the digits change.
  const timeWidth = ctx.measureText(`${hud.soyDuration.toFixed(1)}s`).width
  const width = padX * 2 + ctx.measureText(label).width + gap + timeWidth
  const height = padY * 2 + fontSize + padY * 0.6 + barHeight
  const x = margin
  const y = view.width < 600 ? Math.max(110, top) : top

  const textY = y + padY + fontSize / 2
  ctx.fillStyle = colors.labelHalo
  ctx.strokeStyle = colors.outline
  ctx.lineWidth = 3
  ctx.textAlign = 'left'
  ctx.strokeText(label, x + padX, textY)
  ctx.fillText(label, x + padX, textY)
  ctx.textAlign = 'right'
  ctx.strokeText(`${hud.soyRemaining.toFixed(1)}s`, x + width - padX, textY)
  ctx.fillText(`${hud.soyRemaining.toFixed(1)}s`, x + width - padX, textY)

  // The bar: an outlined track, filled from the left for as much time as is left.
  const barX = x + padX
  const barY = y + height - padY - barHeight
  const barWidth = width - padX * 2
  const left = clamp01(hud.soyRemaining / hud.soyDuration)
  ctx.lineWidth = Math.max(1.5, fontSize * 0.07)
  ctx.beginPath()
  ctx.rect(barX, barY, barWidth, barHeight)
  ctx.stroke()
  if (left > 0) {
    ctx.fillStyle = colors.popup
    ctx.beginPath()
    ctx.rect(barX, barY, Math.max(barHeight, barWidth * left), barHeight)
    ctx.fill()
  }
  ctx.restore()
}

/** Size and edge gap shared by the HUD pieces in the top right corner. */
function hudFontSize(view: CanvasView): number {
  return clamp(Math.min(view.width, view.height) * 0.045, 16, 30)
}

function hudMargin(view: CanvasView): number {
  return Math.max(12, hudFontSize(view) * 0.7)
}

/**
 * The lives row, top right: one heart per life a game starts with, filled for a life that is
 * left and just an outline for one that is lost. Always drawn while playing. Returns the y where
 * the next HUD piece (the bonus badge) may start.
 */
function drawLives(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  hud: FrameHud,
  colors: PlaceholderColors,
): number {
  const size = hudFontSize(view) * 1.25
  const margin = hudMargin(view)
  const gap = size * 0.25
  const count = Math.max(0, hud.maxLives)

  ctx.save()
  ctx.lineWidth = Math.max(2, size * 0.09)
  ctx.lineJoin = 'miter'
  ctx.strokeStyle = colors.outline
  for (let i = 0; i < count; i += 1) {
    const cx = margin + i * (size + gap) + size / 2
    const cy = margin + size / 2
    const losing = i >= hud.lives && i < hud.lostFrom
    const scale = losing ? 1 - .2 * Math.sin(Math.PI * hud.lossProgress) : 1
    const r = size * scale / 2
    ctx.beginPath()
    ctx.moveTo(cx, cy + r * .85)
    ctx.bezierCurveTo(cx - r * 1.45, cy, cx - r, cy - r, cx, cy - r * .4)
    ctx.bezierCurveTo(cx + r, cy - r, cx + r * 1.45, cy, cx, cy + r * .85)
    ctx.closePath()
    if (i < hud.lives || losing && hud.lossProgress < 1) {
      ctx.fillStyle = colors.heart
      if (losing) ctx.globalAlpha = 1 - hud.lossProgress * .8
    } else {
      ctx.fillStyle = colors.labelHalo // an empty heart: pale, with the same outline
      ctx.globalAlpha = 0.55
    }
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.stroke()
  }
  ctx.restore()

  ctx.save()
  ctx.font = '600 12px Fraunces, serif'
  ctx.textAlign = 'left'
  ctx.strokeStyle = colors.outline
  ctx.lineWidth = 2.5
  ctx.strokeText(`LIVES ${hud.lives}/${hud.maxLives}`, margin, margin + size + 18)
  ctx.fillStyle = colors.labelHalo
  ctx.fillText(`LIVES ${hud.lives}/${hud.maxLives}`, margin, margin + size + 18)
  ctx.restore()
  return margin + size + 26
}

/**
 * "You lost a life": a coloured frame around the screen edge that fades out. It is drawn at the
 * edges only, so the sushi and the player's hand in the middle stay clear, and it fades once per
 * hit (no blinking). Drawn only while hud.penalty is above 0.
 */
function drawPenaltyFrame(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  hud: FrameHud,
  colors: PlaceholderColors,
): void {
  if (hud.penalty <= 0) return
  const thickness = Math.min(view.width, view.height) * 0.05
  ctx.save()
  ctx.globalAlpha = 0.55 * clamp01(hud.penalty)
  ctx.fillStyle = colors.penalty
  ctx.fillRect(0, 0, view.width, thickness) // top
  ctx.fillRect(0, view.height - thickness, view.width, thickness) // bottom
  ctx.fillRect(0, thickness, thickness, view.height - thickness * 2) // left
  ctx.fillRect(view.width - thickness, thickness, thickness, view.height - thickness * 2) // right
  ctx.restore()
}

const spriteImages = new Map<string, HTMLImageElement>()
/** Start each image once. Until it loads (or if it fails), keep the labeled shape. */
export function preloadSprites() {
  for (const category of ['sushi', 'powerups', 'hazards'] as const) {
    for (const entry of assetManifest[category]) {
      const url = getAssetUrl(category, entry.id)
      if (!url || spriteImages.has(entry.id)) continue
      const image = new Image()
      spriteImages.set(entry.id, image)
      image.src = url
    }
  }
}

/** Draws one flying object's placeholder: a bottle, a wasabi mound, or the sushi block. */
function drawObjectPlaceholder(
  ctx: CanvasRenderingContext2D,
  sushi: Sushi,
  colors: PlaceholderColors,
): void {
  const image = spriteImages.get(sushi.type.id)
  if (image?.complete && image.naturalWidth > 0) {
    ctx.save()
    ctx.translate(sushi.x, sushi.y)
    ctx.rotate(sushi.angle)
    ctx.drawImage(image, -sushi.radius, -sushi.radius, sushi.radius * 2, sushi.radius * 2)
    ctx.restore()
    return
  }
  // Missing-image fallback follows the same square geometry as the interface.
  ctx.save()
  ctx.translate(sushi.x, sushi.y)
  ctx.fillStyle = sushi.type.kind === 'wasabi' ? colors.wasabi : colors.rice
  ctx.strokeStyle = colors.outline
  ctx.lineWidth = 2
  ctx.fillRect(-sushi.radius, -sushi.radius, sushi.radius * 2, sushi.radius * 2)
  ctx.strokeRect(-sushi.radius, -sushi.radius, sushi.radius * 2, sushi.radius * 2)
  ctx.textAlign = 'center'
  ctx.fillStyle = colors.outline
  ctx.font = '700 12px Fraunces, serif'
  ctx.fillText(sushi.type.label, 0, 0)
  ctx.font = '10px Fraunces, serif'
  ctx.fillText('image unavailable', 0, 18)
  ctx.restore()
}
