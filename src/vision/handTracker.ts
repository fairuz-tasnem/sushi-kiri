import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { NormalizedPoint } from './coordinateMapper'
import type { HandLandmark } from './gestures'

/**
 * Thin wrapper around MediaPipe's Hand Landmarker. It knows nothing about React,
 * the screen or the cursor: give it a video frame, get back the index fingertip.
 *
 * Where the files come from
 * -------------------------
 * MediaPipe needs two things at run time, and both are downloaded by the browser
 * the first time tracking starts (so the first start needs an internet connection):
 *   - the WebAssembly runtime, from the jsDelivr CDN
 *   - the hand model (about 8 MB), from Google's model storage
 * Both are cached by the browser afterwards.
 *
 * TASKS_VISION_VERSION MUST equal the version of @mediapipe/tasks-vision in
 * package.json (it is installed with an exact version, no ^, for this reason).
 * To work offline instead, copy node_modules/@mediapipe/tasks-vision/wasm and the
 * .task model file into public/mediapipe/ and point the two URLs below at
 * '/mediapipe/wasm' and '/mediapipe/hand_landmarker.task'.
 */
const TASKS_VISION_VERSION = '1.1.1'
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`
const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** MediaPipe numbers the 21 hand landmarks; 8 is the tip of the index finger. */
export const INDEX_FINGERTIP = 8

/**
 * How sure MediaPipe must be before it reports a hand. Below these it returns
 * no hand at all, which the game treats as "hand not detected" (cursor hidden).
 * The library default is 0.5 for all three; slightly higher values cut down on
 * flickering false hands in the background.
 */
const MIN_HAND_DETECTION_CONFIDENCE = 0.6
const MIN_HAND_PRESENCE_CONFIDENCE = 0.6
const MIN_TRACKING_CONFIDENCE = 0.5

export class HandTracker {
  /** MediaPipe's video mode needs every timestamp to be larger than the one before. */
  private lastTimestamp = -1
  private closed = false

  /**
   * All 21 landmarks of the hand found by the most recent detect() call, or null when that
   * call found no hand. Read it right after detect(); it is replaced on every call. It is
   * the raw, unmirrored 0..1 frame positions, and (unlike the return value of detect) it is
   * kept even when the index fingertip is outside the frame. The gesture recogniser uses it.
   */
  latestLandmarks: readonly HandLandmark[] | null = null

  private constructor(private readonly landmarker: HandLandmarker) {}

  /**
   * Downloads and starts the model. Takes a few seconds the first time.
   * Tries the GPU first and falls back to the CPU if the GPU cannot be used.
   * Rejects if the files cannot be downloaded or WebAssembly is unavailable.
   */
  static async create(): Promise<HandTracker> {
    const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)

    const build = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numHands: 1, // one hand only
        minHandDetectionConfidence: MIN_HAND_DETECTION_CONFIDENCE,
        minHandPresenceConfidence: MIN_HAND_PRESENCE_CONFIDENCE,
        minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
      })

    try {
      return new HandTracker(await build('GPU'))
    } catch (gpuError) {
      console.warn('Hand tracking: GPU delegate unavailable, using the CPU instead.', gpuError)
      return new HandTracker(await build('CPU'))
    }
  }

  /**
   * Looks at one video frame. Returns the index fingertip as a 0..1 position on
   * the RAW camera frame (not mirrored, not cropped), or null when there is no
   * usable hand: nothing found, below the confidence thresholds, or the fingertip
   * is outside the camera frame.
   *
   * This call is synchronous: it returns when detection has finished, so two
   * detections can never overlap as long as it is called from one loop.
   */
  detect(video: HTMLVideoElement, nowMs: number): NormalizedPoint | null {
    this.latestLandmarks = null
    if (this.closed) return null

    const timestamp = Math.max(nowMs, this.lastTimestamp + 1)
    this.lastTimestamp = timestamp

    const result = this.landmarker.detectForVideo(video, timestamp)
    this.latestLandmarks = result.landmarks[0] ?? null
    const tip = result.landmarks[0]?.[INDEX_FINGERTIP]
    if (!tip || !Number.isFinite(tip.x) || !Number.isFinite(tip.y)) return null
    if (tip.x < 0 || tip.x > 1 || tip.y < 0 || tip.y > 1) return null

    return { x: tip.x, y: tip.y }
  }

  /** Frees the model and its WebAssembly memory. Safe to call twice. */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.landmarker.close()
  }
}
