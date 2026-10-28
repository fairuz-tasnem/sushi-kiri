/**
 * Hand gesture recognition for three "command" poses, built only on the 21 landmarks that
 * MediaPipe's Hand Landmarker already returns. No new model, no new dependency, no React,
 * no DOM: plain functions and one small class, so everything here can be tested with
 * fixed landmark numbers (see tests/gestures.test.ts).
 *
 * Two layers
 * ----------
 *   1. classifyHandPose(): ONE frame of landmarks in, one pose out. Pure geometry.
 *   2. GestureRecognizer:  a stream of frames in, a command out ONLY after the same pose
 *                          has been held without interruption for long enough.
 *
 * This file does NOT decide what a command does. Nothing here touches screens, pause,
 * or the game; a later task subscribes to the commands (see useHandTracker.ts).
 */

/** One MediaPipe landmark. x and y are 0..1 on the raw camera frame (y grows downward). */
export interface HandLandmark {
  x: number
  y: number
  z?: number
}

/** The three commands the player can give with a held pose. */
export type GestureCommandType = 'thumbs-up' | 'open-palm' | 'v-sign'

/** What one frame of landmarks looks like. 'none' covers everything else (fist, pointing, ...). */
export type HandPose = GestureCommandType | 'none'

/** A recognized command. This is the whole public output of the module. */
export interface GestureCommand {
  gesture: GestureCommandType
  /** Timestamp (ms, same clock as the frames given to update()) at which the hold completed. */
  timestamp: number
  /** How long the pose had been held when it fired, in ms (at least the required time). */
  heldMs: number
}

/** Called once for each recognized command. */
export type GestureCommandListener = (command: GestureCommand) => void

/** One frame given to the recognizer. */
export interface GestureInput {
  /** All 21 landmarks of one hand. */
  landmarks: readonly HandLandmark[]
  /**
   * Camera frame width divided by height (video.videoWidth / video.videoHeight).
   * Landmarks are fractions of width and of height, so without this a 16:9 frame would
   * stretch every distance sideways. Default 1.
   */
  aspect?: number
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------

/** How long each pose must be held without interruption before it counts. */
export const HOLD_MS: Readonly<Record<GestureCommandType, number>> = {
  'thumbs-up': 800,
  'open-palm': 800,
  'v-sign': 1000,
}

/** After any command fires, no command (of any kind) can fire, or start timing, for this long. */
export const COOLDOWN_MS = 1500

/** Two frames further apart than this are not "continuous": the hold is dropped. */
export const MAX_FRAME_GAP_MS = 300

// ---------------------------------------------------------------------------
// Geometry thresholds. Every distance is divided by the PALM LENGTH (wrist to the base of
// the middle finger), so they do not depend on how far the hand is from the camera.
// ---------------------------------------------------------------------------

/** Landmark numbers (MediaPipe hand model). */
const WRIST = 0
const THUMB_MCP = 2
const THUMB_IP = 3
const THUMB_TIP = 4
const INDEX_MCP = 5
const MIDDLE_MCP = 9

/** [MCP, PIP, tip] landmark numbers of the four fingers. */
const INDEX: FingerJoints = [5, 6, 8]
const MIDDLE: FingerJoints = [9, 10, 12]
const RING: FingerJoints = [13, 14, 16]
const PINKY: FingerJoints = [17, 18, 20]
type FingerJoints = readonly [mcp: number, pip: number, tip: number]

const LANDMARK_COUNT = 21

/** A hand whose palm is smaller than this (in frame heights) is too far/small to judge. */
const MIN_PALM_LENGTH = 0.03

/**
 * A finger's "reach" is (wrist to fingertip) / (wrist to the finger's own base joint).
 * A straight finger is about 1.8, a curled one about 0.8 to 1.2. The gap between the two
 * limits is deliberate: a half-bent finger is "unsure", and an unsure finger never
 * produces a command.
 */
const FINGER_EXTENDED_REACH = 1.55
const FINGER_CURLED_REACH = 1.3

/** Thumb straightness: (MCP to tip) / (MCP to IP + IP to tip). 1 means perfectly straight. */
const THUMB_MIN_STRAIGHTNESS = 0.8
/** Thumbs-up: the thumb (MCP to tip) must be at least this long, in palms. */
const THUMBS_UP_MIN_THUMB_LENGTH = 0.45
/** Thumbs-up: how much of the thumb's direction must point up the image (1 = straight up). */
const THUMBS_UP_MIN_UPWARD = 0.75
/** Thumbs-up: the thumb tip must be this far above the index finger's base, in palms. */
const THUMBS_UP_MIN_TIP_ABOVE_KNUCKLE = 0.3
/** Open palm: the thumb tip must be at least this far from the index base, in palms (not tucked in). */
const OPEN_PALM_MIN_THUMB_OUT = 0.5
/** V-sign: index/middle tips must be this many times further apart than their bases (a real V, not parallel). */
const V_MIN_SPREAD_RATIO = 1.3

/** Hold stability: if the wrist drifts further than this (in palms) from where the hold began, the timer restarts. */
const MAX_HOLD_DRIFT = 0.75

// ---------------------------------------------------------------------------
// Layer 1: one frame -> one pose
// ---------------------------------------------------------------------------

type FingerState = 'extended' | 'curled' | 'unsure'

interface Point {
  x: number
  y: number
}

function isValidLandmarks(landmarks: readonly HandLandmark[] | null | undefined): landmarks is readonly HandLandmark[] {
  if (!landmarks || landmarks.length < LANDMARK_COUNT) return false
  for (let i = 0; i < LANDMARK_COUNT; i += 1) {
    const p = landmarks[i]
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return false
  }
  return true
}

/**
 * Classifies one frame of hand landmarks.
 *
 *   thumbs-up  four fingers clearly curled; thumb straight, long, and pointing up the image
 *              (the image's "up", so a thumbs-up turned sideways is not recognized)
 *   open-palm  four fingers clearly straight and the thumb out (not tucked in)
 *   v-sign     index and middle clearly straight and spread apart, ring and pinky clearly
 *              curled (thumb ignored)
 *   none       anything else, including a fist, a pointing index finger (the slicing pose),
 *              a half-bent finger, two fingers held together, or too few landmarks
 *
 * Only distances and one direction are used, so the result does not depend on hand size,
 * distance from the camera, or (except for the thumbs-up) which way the hand is turned.
 * Left and right hands, and mirrored video, give the same answer.
 *
 * @param aspect camera frame width / height (see GestureInput.aspect)
 */
export function classifyHandPose(landmarks: readonly HandLandmark[] | null | undefined, aspect = 1): HandPose {
  if (!isValidLandmarks(landmarks)) return 'none'
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1

  // Work in a space where one unit is the same length horizontally and vertically.
  const at = (i: number): Point => ({ x: landmarks[i].x * safeAspect, y: landmarks[i].y })
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

  const wrist = at(WRIST)
  const palm = dist(wrist, at(MIDDLE_MCP))
  if (palm < MIN_PALM_LENGTH) return 'none'

  const fingerState = ([mcp, pip, tip]: FingerJoints): FingerState => {
    const baseReach = dist(wrist, at(mcp))
    if (baseReach <= 0) return 'unsure'
    const reach = dist(wrist, at(tip)) / baseReach
    const tipBeyondPip = dist(wrist, at(tip)) > dist(wrist, at(pip))
    if (reach >= FINGER_EXTENDED_REACH && tipBeyondPip) return 'extended'
    if (reach <= FINGER_CURLED_REACH) return 'curled'
    return 'unsure'
  }

  const index = fingerState(INDEX)
  const middle = fingerState(MIDDLE)
  const ring = fingerState(RING)
  const pinky = fingerState(PINKY)

  const thumbMcp = at(THUMB_MCP)
  const thumbIp = at(THUMB_IP)
  const thumbTip = at(THUMB_TIP)
  const indexMcp = at(INDEX_MCP)

  // --- V-sign: index + middle straight and spread, ring + pinky curled -------------------
  if (index === 'extended' && middle === 'extended' && ring === 'curled' && pinky === 'curled') {
    const baseGap = dist(indexMcp, at(MIDDLE_MCP))
    const tipGap = dist(at(INDEX[2]), at(MIDDLE[2]))
    if (baseGap > 0 && tipGap / baseGap >= V_MIN_SPREAD_RATIO) return 'v-sign'
    return 'none' // two fingers held together
  }

  // --- Open palm: all four straight, thumb out --------------------------------------------
  if (index === 'extended' && middle === 'extended' && ring === 'extended' && pinky === 'extended') {
    return dist(thumbTip, indexMcp) / palm >= OPEN_PALM_MIN_THUMB_OUT ? 'open-palm' : 'none'
  }

  // --- Thumbs-up: four curled, thumb straight and pointing up -----------------------------
  if (index === 'curled' && middle === 'curled' && ring === 'curled' && pinky === 'curled') {
    const thumbLength = dist(thumbMcp, thumbTip)
    const bones = dist(thumbMcp, thumbIp) + dist(thumbIp, thumbTip)
    if (thumbLength / palm < THUMBS_UP_MIN_THUMB_LENGTH || bones <= 0) return 'none'
    if (thumbLength / bones < THUMB_MIN_STRAIGHTNESS) return 'none'
    const upward = (thumbMcp.y - thumbTip.y) / thumbLength // image y grows downward
    if (upward < THUMBS_UP_MIN_UPWARD) return 'none'
    if ((indexMcp.y - thumbTip.y) / palm < THUMBS_UP_MIN_TIP_ABOVE_KNUCKLE) return 'none'
    return 'thumbs-up'
  }

  // Everything else, notably index-only pointing (index straight, the rest curled): not a command.
  return 'none'
}

// ---------------------------------------------------------------------------
// Layer 2: a stream of frames -> commands
// ---------------------------------------------------------------------------

/**
 * Turns per-frame poses into commands. Feed it EVERY frame with update(); pass null when
 * there is no hand. It returns the command on the one frame where a hold completes, and null
 * on every other frame.
 *
 * Rules
 * -----
 *  - A pose counts only after it is held without interruption: HOLD_MS[pose].
 *  - The timer restarts if the pose changes (including to 'none'), if tracking is lost
 *    (null input, invalid landmarks, or a gap of more than MAX_FRAME_GAP_MS between frames),
 *    or if the wrist drifts more than MAX_HOLD_DRIFT palms from where the hold began (so a
 *    sweeping open hand, as when slicing, never counts as a held pose).
 *  - One trigger per hold: after a command fires, holding the same pose longer does nothing.
 *  - Change pose first: after a command fires, that same gesture cannot fire again until a
 *    different pose (any other pose, including 'none') has been seen on a tracked frame.
 *    Losing and regaining tracking is not a pose change.
 *  - Cooldown: for COOLDOWN_MS after a command, nothing can fire, and a new hold's timer does
 *    not start counting until the cooldown is over (so the full hold time still applies).
 */
export class GestureRecognizer {
  private candidate: GestureCommandType | null = null
  private holdStart = 0
  private anchor: Point = { x: 0, y: 0 }
  private lastFrameTime: number | null = null
  private cooldownUntil = -Infinity
  /** The gesture that last fired, until a different pose is seen. */
  private blocked: GestureCommandType | null = null

  /** Processes one frame. Returns the command if one was just completed, otherwise null. */
  update(input: GestureInput | null, nowMs: number): GestureCommand | null {
    if (!Number.isFinite(nowMs)) return null

    // Time went backwards, or the frames are too far apart: the hold is not continuous.
    if (this.lastFrameTime !== null && (nowMs < this.lastFrameTime || nowMs - this.lastFrameTime > MAX_FRAME_GAP_MS)) {
      this.dropHold()
    }
    this.lastFrameTime = nowMs

    // Tracking lost.
    if (!input || !isValidLandmarks(input.landmarks)) {
      this.dropHold()
      return null
    }

    const aspect = input.aspect !== undefined && Number.isFinite(input.aspect) && input.aspect > 0 ? input.aspect : 1
    const pose = classifyHandPose(input.landmarks, aspect)

    // After a command, the same gesture stays locked until a different pose shows up.
    if (this.blocked !== null) {
      if (pose === this.blocked) return null
      this.blocked = null
    }

    if (pose === 'none') {
      this.dropHold()
      return null
    }

    const wrist = this.wristPosition(input.landmarks, aspect)
    if (this.candidate !== pose) {
      this.beginHold(pose, nowMs, wrist)
    } else if (this.driftedTooFar(input.landmarks, aspect, wrist)) {
      this.beginHold(pose, nowMs, wrist)
    }

    // The timer cannot run during the cooldown, so it effectively starts when the cooldown ends.
    const effectiveStart = Math.max(this.holdStart, this.cooldownUntil)
    const heldMs = nowMs - effectiveStart
    if (heldMs < HOLD_MS[pose]) return null

    this.cooldownUntil = nowMs + COOLDOWN_MS
    this.blocked = pose
    this.dropHold()
    return { gesture: pose, timestamp: nowMs, heldMs }
  }

  /**
   * Forgets any hold in progress (call it when tracking stops). The cooldown and the
   * "change pose first" lock are kept, because they protect against repeats and the
   * player has not changed anything by losing tracking.
   */
  reset(): void {
    this.dropHold()
    this.lastFrameTime = null
  }

  private beginHold(pose: GestureCommandType, nowMs: number, wrist: Point): void {
    this.candidate = pose
    this.holdStart = nowMs
    this.anchor = wrist
  }

  private dropHold(): void {
    this.candidate = null
  }

  private wristPosition(landmarks: readonly HandLandmark[], aspect: number): Point {
    return { x: landmarks[WRIST].x * aspect, y: landmarks[WRIST].y }
  }

  private driftedTooFar(landmarks: readonly HandLandmark[], aspect: number, wrist: Point): boolean {
    const mid = { x: landmarks[MIDDLE_MCP].x * aspect, y: landmarks[MIDDLE_MCP].y }
    const palm = Math.hypot(wrist.x - mid.x, wrist.y - mid.y)
    if (palm <= 0) return false
    return Math.hypot(wrist.x - this.anchor.x, wrist.y - this.anchor.y) / palm > MAX_HOLD_DRIFT
  }
}
