/**
 * Deterministic hand-landmark fixtures for the gesture tests. No camera, no MediaPipe: each
 * hand is 21 fixed points built from a few numbers, in a square (aspect 1) frame, wrist near
 * the bottom, fingers pointing up the image. One palm length (wrist to middle-finger base)
 * is 0.2, so every distance in the thresholds can be checked by hand.
 */
import type { HandLandmark } from '../src/vision/gestures.ts'

export type FingerPose = 'extended' | 'curled' | 'half'
export type ThumbPose = 'up' | 'out' | 'down' | 'tucked'

export interface HandSpec {
  thumb: ThumbPose
  index: FingerPose
  middle: FingerPose
  ring: FingerPose
  pinky: FingerPose
  /** Make index and middle point the same way (parallel, "held together") instead of fanning out. */
  together?: boolean
}

const WRIST = { x: 0.5, y: 0.85 }
const BASES = {
  index: { x: 0.43, y: 0.66 },
  middle: { x: 0.5, y: 0.65 },
  ring: { x: 0.57, y: 0.66 },
  pinky: { x: 0.63, y: 0.69 },
} as const

/** [pip, dip, tip] distances along the finger direction, from its base joint. */
const SHAPES: Record<FingerPose, readonly [number, number, number]> = {
  extended: [0.07, 0.115, 0.155],
  curled: [0.065, 0.05, 0.03],
  half: [0.07, 0.08, 0.09], // reach about 1.44: between "curled" and "extended"
}

const THUMBS: Record<ThumbPose, readonly Pt[]> = {
  // [cmc, mcp, ip, tip]
  up: [pt(0.44, 0.78), pt(0.41, 0.72), pt(0.39, 0.65), pt(0.375, 0.575)],
  out: [pt(0.44, 0.78), pt(0.38, 0.74), pt(0.33, 0.7), pt(0.285, 0.665)],
  down: [pt(0.44, 0.78), pt(0.41, 0.84), pt(0.39, 0.91), pt(0.375, 0.985)],
  tucked: [pt(0.45, 0.78), pt(0.44, 0.73), pt(0.45, 0.69), pt(0.46, 0.67)],
}

type Pt = { x: number; y: number }
function pt(x: number, y: number): Pt {
  return { x, y }
}

export function makeHand(spec: HandSpec): HandLandmark[] {
  const points: Pt[] = [WRIST, ...THUMBS[spec.thumb]]
  const names = ['index', 'middle', 'ring', 'pinky'] as const
  for (const name of names) {
    const base = BASES[name]
    let dx = base.x - WRIST.x
    let dy = base.y - WRIST.y
    if (spec.together && (name === 'index' || name === 'middle')) {
      dx = 0
      dy = -1
    }
    const len = Math.hypot(dx, dy)
    const dir = { x: dx / len, y: dy / len }
    points.push(base)
    for (const d of SHAPES[spec[name]]) {
      points.push({ x: base.x + dir.x * d, y: base.y + dir.y * d })
    }
  }
  return points.map((p) => ({ x: p.x, y: p.y, z: 0 }))
}

export const THUMBS_UP = (): HandLandmark[] =>
  makeHand({ thumb: 'up', index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' })
export const OPEN_PALM = (): HandLandmark[] =>
  makeHand({ thumb: 'out', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' })
export const V_SIGN = (): HandLandmark[] =>
  makeHand({ thumb: 'tucked', index: 'extended', middle: 'extended', ring: 'curled', pinky: 'curled' })
/** The slicing pose: index finger out, everything else closed. */
export const POINTING = (): HandLandmark[] =>
  makeHand({ thumb: 'tucked', index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' })
export const FIST = (): HandLandmark[] =>
  makeHand({ thumb: 'tucked', index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' })

export function shifted(hand: readonly HandLandmark[], dx: number, dy = 0): HandLandmark[] {
  return hand.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
}

/** Rotates the hand around its wrist by `degrees` (positive = clockwise on screen). */
export function rotated(hand: readonly HandLandmark[], degrees: number): HandLandmark[] {
  const a = (degrees * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return hand.map((p) => {
    const x = p.x - WRIST.x
    const y = p.y - WRIST.y
    return { ...p, x: WRIST.x + x * c - y * s, y: WRIST.y + x * s + y * c }
  })
}

/** Re-expresses a square-frame hand as it would be reported for a frame `aspect` times wider than tall. */
export function inWideFrame(hand: readonly HandLandmark[], aspect: number): HandLandmark[] {
  return hand.map((p) => ({ ...p, x: p.x / aspect }))
}

export function mirroredHorizontally(hand: readonly HandLandmark[]): HandLandmark[] {
  return hand.map((p) => ({ ...p, x: 1 - p.x }))
}
