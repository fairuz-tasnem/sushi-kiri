/**
 * Slicing, Day 3A part 2: turns fingertip readings into a swipe line, decides when that
 * line cuts the sushi, and keeps the short trail and score popups the renderer draws.
 *
 * Pure game logic. No React, no DOM, no drawing, no camera code. GameCanvas.tsx converts a
 * fingertip reading into Canvas pixels (it knows the video and the canvas) and then calls
 * the functions here with that position, so everything in this file works in the same
 * CSS-pixel space as the sushi (0, 0 = top-left of the canvas, y grows downward).
 *
 * The rules that keep tracking trouble from ever causing a slice
 * ---------------------------------------------------------------
 * A swipe is a line between two CONSECUTIVE good readings. The "previous good reading"
 * is forgotten, together with the trail, whenever:
 *   - tracking is lost or below the tracker's confidence thresholds (GameCanvas calls
 *     resetFingertip when the tracker publishes null),
 *   - the tracker says this reading follows a gap (sample.previous is null),
 *   - the fingertip is not on the visible play area (GameCanvas calls resetFingertip), or
 *   - the fingertip jumped further than a hand can move in the time that passed
 *     (checked in advanceFingertip).
 * The reading that arrives after a reset only STARTS a new sequence: it has nothing to be
 * joined to, so it can neither draw a trail segment nor cut anything. Slicing resumes with
 * the next good reading. Nothing is ever connected across a gap.
 */

import type { CanvasView } from './canvasView'
import type { Sushi } from './sushi'

export interface Point {
  x: number
  y: number
}

/** The straight line the fingertip travelled between two consecutive readings. */
export interface Segment {
  from: Point
  to: Point
}

/** One remembered fingertip position in the fading trail. */
export interface TrailPoint extends Point {
  /** Seconds since this position was recorded. */
  age: number
}

/** The "+10" that floats up where a sushi was cut. */
export interface ScorePopup extends Point {
  points: number
  /** Text to show instead of "+points", for example "-1 life". */
  label?: string
  /** True for a penalty: drawn in the penalty colour instead of the score colour. */
  penalty?: boolean
  /** Seconds since the cut. */
  age: number
}

/* ---------- Tuning ---------- */

/**
 * Extra reach added to the sushi's radius, in pixels. The fingertip is a dot but the cursor
 * the player aims with is a ring about 20 to 30 px wide, and camera readings wobble by a few
 * pixels, so a swipe that visibly grazes the edge still counts.
 */
const BLADE_PADDING = 6

/** How long a trail point lives, and the most points kept (a fast hand adds one per reading). */
export const TRAIL_LIFETIME_SECONDS = 0.25
const MAX_TRAIL_POINTS = 40

/** How long a score popup lives. */
export const POPUP_LIFETIME_SECONDS = 0.9

/**
 * The implausible-jump limit. The fingertip may move at most this many screen DIAGONALS per
 * second; 10 means crossing the whole screen corner to corner in a tenth of a second, which is
 * faster than a real flick. A fast swipe stays well under it, so it still slices, while a
 * reading that teleports (the tracker latching onto a different hand or object) is refused.
 * MIN_JUMP_DIAGONALS is a floor so that very short gaps between readings are not judged too
 * strictly: whatever the timing, a move under a quarter of the diagonal is always accepted.
 */
const MAX_SPEED_DIAGONALS_PER_SECOND = 10
const MIN_JUMP_DIAGONALS = 0.25

/** The cut direction follows the whole trail when it spans at least this many pixels. */
const MIN_TRAIL_SPAN_FOR_ANGLE = 12

/* ---------- Fingertip sequence ---------- */

export interface Fingertip {
  /** The last good position of the CURRENT sequence, or null when no sequence is running. */
  previous: Point | null
  /** performance.now()-style time of that reading, in milliseconds. */
  previousTime: number
  /**
   * The fading trail, oldest first. This array is only ever emptied in place (never replaced),
   * so a reference handed to the renderer stays valid.
   */
  trail: TrailPoint[]
}

export function createFingertip(): Fingertip {
  return { previous: null, previousTime: 0, trail: [] }
}

/**
 * Forgets the previous position and wipes the trail at once. Call it for every kind of
 * tracking trouble. Safe to call any number of times.
 */
export function resetFingertip(fingertip: Fingertip): void {
  fingertip.previous = null
  fingertip.previousTime = 0
  fingertip.trail.length = 0
}

/**
 * Records one good reading and returns the line travelled since the reading before it.
 *
 * Returns null when this reading starts a new sequence (the first one, the first after a
 * reset, or one that failed the jump check): there is nothing to join it to, so nothing can
 * be sliced by it. A reading that fails the jump check wipes the old sequence and then
 * becomes the first point of a new one.
 *
 * @param position  the fingertip in canvas pixels
 * @param timeMs    when the camera frame was taken (FingertipSample.timestamp)
 */
export function advanceFingertip(
  fingertip: Fingertip,
  position: Point,
  timeMs: number,
  view: CanvasView,
): Segment | null {
  const before = fingertip.previous
  if (before && isImplausibleJump(before, position, timeMs - fingertip.previousTime, view)) {
    resetFingertip(fingertip)
  }

  const from = fingertip.previous // null again if the jump check just reset it
  const to: Point = { x: position.x, y: position.y }
  fingertip.previous = to
  fingertip.previousTime = timeMs

  fingertip.trail.push({ x: to.x, y: to.y, age: 0 })
  if (fingertip.trail.length > MAX_TRAIL_POINTS) {
    fingertip.trail.splice(0, fingertip.trail.length - MAX_TRAIL_POINTS)
  }

  return from ? { from, to } : null
}

function isImplausibleJump(from: Point, to: Point, elapsedMs: number, view: CanvasView): boolean {
  const diagonal = Math.hypot(view.width, view.height)
  const seconds = Math.max(0, elapsedMs) / 1000
  const allowed = diagonal * Math.max(MIN_JUMP_DIAGONALS, MAX_SPEED_DIAGONALS_PER_SECOND * seconds)
  return Math.hypot(to.x - from.x, to.y - from.y) > allowed
}

/** Ages the trail by one frame and drops points that have faded out. Call once per update. */
export function ageFingertipTrail(fingertip: Fingertip, deltaSeconds: number): void {
  const { trail } = fingertip
  for (const point of trail) point.age += deltaSeconds

  // The oldest points are at the front, so expired ones are always a block at the start.
  let expired = 0
  while (expired < trail.length && trail[expired].age > TRAIL_LIFETIME_SECONDS) expired += 1
  if (expired > 0) trail.splice(0, expired)
}

/* ---------- Collision and cutting ---------- */

/** The shortest distance from `point` to the segment a-b (to the nearest end if it is beyond one). */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const abX = b.x - a.x
  const abY = b.y - a.y
  const lengthSquared = abX * abX + abY * abY

  // A segment of length zero is a single point.
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)

  // How far along a-b the closest point is: 0 at a, 1 at b.
  const along = ((point.x - a.x) * abX + (point.y - a.y) * abY) / lengthSquared
  const t = Math.min(1, Math.max(0, along))
  return Math.hypot(point.x - (a.x + t * abX), point.y - (a.y + t * abY))
}

/**
 * True when the swipe line touches the sushi's collision circle (its centre and radius, plus a
 * little reach). It tests the WHOLE line, not just where the fingertip is now, so a swipe so
 * fast that one reading is on one side of the sushi and the next on the other still hits it,
 * and so does a slow swipe that only grazes it.
 */
export function segmentHitsSushi(sushi: Sushi, segment: Segment): boolean {
  const distance = distanceToSegment({ x: sushi.x, y: sushi.y }, segment.from, segment.to)
  return distance <= sushi.radius + BLADE_PADDING
}

/**
 * Cuts the object (a sushi or a soy sauce bottle) if the swipe touches it. Returns true ONLY for
 * the swipe that actually makes the cut: an object that is already cut answers false to
 * everything. The caller hands the cut objects to scoring.ts, which applies their effect and
 * has its own once-only guard on top of this one.
 */
export function trySliceSushi(sushi: Sushi, segment: Segment, fingertip: Fingertip): boolean {
  if (sushi.slice !== null) return false
  if (!segmentHitsSushi(sushi, segment)) return false

  sushi.slice = { angle: swipeAngle(fingertip, segment), age: 0 }
  return true
}

/**
 * The direction of the swipe, in radians. One reading-to-reading segment is only a pixel or two
 * long in a slow swipe, so its direction is mostly camera wobble; the direction from the oldest
 * trail point to now is steadier. Short swipes fall back to the segment itself.
 */
function swipeAngle(fingertip: Fingertip, segment: Segment): number {
  const oldest = fingertip.trail[0]
  if (oldest) {
    const dx = segment.to.x - oldest.x
    const dy = segment.to.y - oldest.y
    if (Math.hypot(dx, dy) >= MIN_TRAIL_SPAN_FOR_ANGLE) return Math.atan2(dy, dx)
  }
  return Math.atan2(segment.to.y - segment.from.y, segment.to.x - segment.from.x)
}

/* ---------- Score popups ---------- */

/**
 * Starts a "+points" popup where the sushi was cut. It is pinned to that spot (not to the
 * sushi, which keeps moving and may leave the screen), and kept a little inside the canvas
 * so it can always be read.
 */
export function addScorePopup(
  popups: ScorePopup[],
  sushi: Sushi,
  view: CanvasView,
  points: number,
): void {
  const margin = 48
  popups.push({
    x: Math.min(view.width - margin, Math.max(margin, sushi.x)),
    y: Math.min(view.height - margin, Math.max(margin, sushi.y)),
    points,
    age: 0,
  })
}

/** Like addScorePopup, but for a penalty: shows `label` (for example "-1 life") in the penalty colour. */
export function addPenaltyPopup(
  popups: ScorePopup[],
  sushi: Sushi,
  view: CanvasView,
  label: string,
): void {
  addScorePopup(popups, sushi, view, 0)
  const popup = popups[popups.length - 1]
  popup.label = label
  popup.penalty = true
}

/** Ages the popups by one frame and removes the ones that have finished. Call once per update. */
export function ageScorePopups(popups: ScorePopup[], deltaSeconds: number): void {
  for (let i = popups.length - 1; i >= 0; i -= 1) {
    popups[i].age += deltaSeconds
    if (popups[i].age > POPUP_LIFETIME_SECONDS) popups.splice(i, 1)
  }
}
