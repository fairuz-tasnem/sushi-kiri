import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NormalizedPoint } from './coordinateMapper'
import { smoothPoint } from './smoothPoint'
import { HandTracker } from './handTracker'
import { GestureRecognizer } from './gestures'
import type { GestureCommand, GestureCommandListener } from './gestures'

/**
 * What hand tracking is doing right now:
 *   idle        the camera is not running, so there is nothing to track
 *               (the camera notice already explains why)
 *   loading     the hand model is downloading / starting
 *   no-hand     tracking works, but no hand is visible (or not clearly enough)
 *   tracking    a hand is visible and its index fingertip is being followed
 *   unavailable the model could not be loaded, or tracking kept failing
 */
export type TrackingStatus = 'idle' | 'loading' | 'no-hand' | 'tracking' | 'unavailable'

/** One fingertip reading. */
export interface FingertipSample {
  /** The index fingertip, 0..1 on the raw camera frame (convert with coordinateMapper). */
  point: NormalizedPoint
  /**
   * The reading just before this one, or null when this is the first reading after
   * a gap (hand lost, camera restarted, tab in the background). Anything that joins
   * positions into a line or a speed MUST use this, never its own "last position",
   * so that a line is never drawn across a gap.
   */
  previous: NormalizedPoint | null
  /** performance.now() time of the video frame, in milliseconds. */
  timestamp: number
}

/** Called for every new reading, and with null when tracking is lost (hide the cursor). */
export type FingertipListener = (sample: FingertipSample | null) => void

export interface HandTrackingState {
  inputMode: 'hand' | 'mouse'
  setInputMode: (mode: 'hand' | 'mouse') => void
  status: TrackingStatus
  /** Tries to load the model again after status became 'unavailable'. */
  retry: () => void
  /**
   * Listen to fingertip readings. Readings arrive up to 60 times a second, so they
   * are delivered like this instead of through React state (which would re-render
   * the whole app every frame). Returns the function that stops listening.
   */
  subscribe: (listener: FingertipListener) => () => void
  /**
   * Listen to recognized gesture commands (thumbs-up, open palm, V-sign; see gestures.ts).
   * Each command is delivered once, after the pose has been held long enough. App routes these through the shared navigation actions. Returns the
   * function that stops listening.
   */
  subscribeGestureCommands: (listener: GestureCommandListener) => () => void
  /**
   * The one <video> element the readings were measured on (null until it exists). A reading
   * is a position on the RAW camera frame, so turning it into screen pixels needs this
   * element's size and on-screen box (see coordinateMapper.ts).
   */
  video: HTMLVideoElement | null
}

type ModelState = 'none' | 'loading' | 'ready' | 'failed'

/** If two readings are further apart in time than this, treat them as separate (a gap). */
const MAX_SAMPLE_GAP_MS = 300

/** After this many detection errors in a row, give up and report 'unavailable'. */
const MAX_CONSECUTIVE_ERRORS = 5

/**
 * Owns hand tracking for the whole session. Call it ONCE, in App.tsx, next to
 * useCameraStream, so that changing screens never restarts it. Screens read the
 * status through useHandTracking() (HandTrackingContext.ts).
 *
 *  - The model loads once, when the camera first becomes ready.
 *  - ONE loop looks at the existing <video> element, one new video frame at a time.
 *  - The loop and the model are stopped/freed only when App unmounts (the session
 *    really ends), or when the camera itself goes away. Screen changes do nothing.
 *
 * @param video        the one <video> element that already shows the camera
 * @param cameraReady  true while the camera stream is running
 */
export function useHandTracker(
  video: HTMLVideoElement | null,
  cameraReady: boolean,
): HandTrackingState {
  const [inputMode, setInputMode] = useState<'hand' | 'mouse'>('hand')
  const [model, setModel] = useState<ModelState>('none')
  const [handDetected, setHandDetected] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const trackerRef = useRef<HandTracker | null>(null)
  const loadingRef = useRef(false)
  /** Bumped on teardown so a model download that finishes late is thrown away, not leaked. */
  const generationRef = useRef(0)
  const listenersRef = useRef(new Set<FingertipListener>())
  const commandListenersRef = useRef(new Set<GestureCommandListener>())

  const subscribe = useCallback((listener: FingertipListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const subscribeGestureCommands = useCallback((listener: GestureCommandListener) => {
    commandListenersRef.current.add(listener)
    return () => {
      commandListenersRef.current.delete(listener)
    }
  }, [])

  const retry = useCallback(() => setAttempt((n) => n + 1), [])

  // 1. Teardown: free the model when App unmounts (or when development hot-reload replaces this code).
  useEffect(() => {
    return () => {
      generationRef.current += 1
      loadingRef.current = false
      trackerRef.current?.close()
      trackerRef.current = null
    }
  }, [])

  // 2. Load the model once, as soon as the camera is ready. Does nothing if it is already
  //    loaded or loading, so camera restarts and screen changes never reload it.
  useEffect(() => {
    if (!cameraReady) {
      generationRef.current += 1
      loadingRef.current = false
      trackerRef.current?.close()
      trackerRef.current = null
      setModel('none')
      return
    }
    if (trackerRef.current || loadingRef.current) return

    const generation = generationRef.current
    loadingRef.current = true
    setModel('loading')

    HandTracker.create().then(
      (tracker) => {
        if (generation !== generationRef.current) {
          tracker.close() // torn down while downloading: do not keep it
          return
        }
        loadingRef.current = false
        trackerRef.current = tracker
        setModel('ready')
      },
      (error: unknown) => {
        if (generation !== generationRef.current) return
        loadingRef.current = false
        console.error('Hand tracking: the model could not be loaded.', error)
        setModel('failed')
      },
    )
  }, [cameraReady, attempt])

  // 3. The one frame loop. It exists only while the camera is running AND the model is
  //    loaded, and it does not depend on which screen is showing.
  useEffect(() => {
    const tracker = trackerRef.current
    if (!video || !cameraReady || model !== 'ready' || !tracker) return

    let cancelled = false
    let handle = 0
    let detected = false
    let previous: NormalizedPoint | null = null
    let previousTime = 0
    let errors = 0
    // Reads the same landmarks as the cursor; it never touches the fingertip path below.
    const recognizer = new GestureRecognizer()

    const publishCommand = (command: GestureCommand) => {
      commandListenersRef.current.forEach((listener) => listener(command))
    }

    const publish = (sample: FingertipSample | null) => {
      listenersRef.current.forEach((listener) => listener(sample))
    }

    const setDetected = (next: boolean) => {
      if (next === detected) return
      detected = next
      setHandDetected(next)
    }

    const loseHand = () => {
      // Forget the old position, so the next reading starts a fresh line.
      if (previous !== null) publish(null)
      previous = null
      setDetected(false)
    }

    const giveUp = (error: unknown) => {
      console.error('Hand tracking stopped after repeated errors.', error)
      cancelled = true
      tracker.close()
      trackerRef.current = null
      setModel('failed')
    }

    let lastVideoTime = -1
    const step = (now: number) => {
      // Wait until the camera has produced a real picture.
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return

      if (video.currentTime === lastVideoTime) return
      lastVideoTime = video.currentTime
      let tip: NormalizedPoint | null = null
      let landmarks: typeof tracker.latestLandmarks = null
      try {
        tip = tracker.detect(video, now)
        landmarks = tracker.latestLandmarks
        errors = 0
      } catch (error) {
        errors += 1
        if (errors >= MAX_CONSECUTIVE_ERRORS) giveUp(error)
      }

      // Gesture commands: every frame, with null when there is no hand (resets the hold).
      const command = recognizer.update(
        landmarks ? { landmarks, aspect: video.videoWidth / video.videoHeight } : null,
        now,
      )
      if (command) publishCommand(command)

      if (!tip) {
        loseHand()
        return
      }

      const continuous = previous !== null && now - previousTime <= MAX_SAMPLE_GAP_MS && Math.hypot(tip.x - previous.x, tip.y - previous.y) < 0.45
      if (continuous && previous) {
        tip = smoothPoint(previous, tip, now - previousTime)
      }
      publish({ point: tip, previous: continuous ? previous : null, timestamp: now })
      previous = tip
      previousTime = now
      setDetected(true)
    }

    // One callback per NEW video frame where the browser supports it; otherwise once per
    // screen refresh. Either way the next call is only scheduled after this one has
    // finished, and detection is synchronous, so two detections can never overlap.
    const useFrameCallback = typeof video.requestVideoFrameCallback === 'function'
    const schedule = () => {
      handle = useFrameCallback
        ? video.requestVideoFrameCallback(onFrame)
        : requestAnimationFrame(onFrame)
    }
    const onFrame = (now: number) => {
      handle = 0
      if (cancelled) return
      step(now)
      if (!cancelled) schedule()
    }

    schedule()

    return () => {
      cancelled = true
      if (handle) {
        if (useFrameCallback) video.cancelVideoFrameCallback(handle)
        else cancelAnimationFrame(handle)
      }
      loseHand() // hide the cursor and forget the position whenever the loop stops
      recognizer.reset() // and drop any gesture hold in progress
    }
  }, [video, cameraReady, model])

  let status: TrackingStatus
  if (!cameraReady) status = 'idle'
  else if (model === 'failed') status = 'unavailable'
  else if (model !== 'ready') status = 'loading'
  else status = handDetected ? 'tracking' : 'no-hand'

  return useMemo(
    () => ({ status, retry, subscribe, subscribeGestureCommands, video, inputMode, setInputMode }),
    [status, retry, subscribe, subscribeGestureCommands, video, inputMode],
  )
}
