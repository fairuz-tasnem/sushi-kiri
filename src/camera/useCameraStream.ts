import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Where the camera is in its life:
 *   idle        nothing asked for yet (the browser has NOT been asked for permission)
 *   loading     waiting for the browser prompt / the camera to start
 *   ready       the live stream is running
 *   denied      the player (or the browser) blocked camera permission
 *   unavailable no camera, camera in use by another app, camera unplugged,
 *               or the page is not on localhost/https
 */
export type CameraStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unavailable'

export interface CameraState {
  status: CameraStatus
  /** The live stream while status is 'ready', otherwise null. */
  stream: MediaStream | null
  /** Asks for the camera. Does nothing if it is already running or starting. */
  stop: () => void
  start: () => Promise<void>
}

/** Permission problems get their own status; everything else means "no usable camera". */
function statusForError(error: unknown): CameraStatus {
  if (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  ) {
    return 'denied'
  }
  return 'unavailable'
}

/**
 * Owns the webcam MediaStream. Call it ONCE, in App.tsx, so that changing
 * screens never restarts the camera. Screens read it through useCamera().
 *
 * The stream is only stopped when App unmounts (the session really ends).
 */
export function useCameraStream(): CameraState {
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [stream, setStream] = useState<MediaStream | null>(null)

  // Refs hold values that must be readable inside async code without re-rendering.
  const streamRef = useRef<MediaStream | null>(null)
  const startingRef = useRef(false)
  const mountedRef = useRef(false)
  const generation = useRef(0)

  /** Stops every track so the camera light turns off. Safe to call twice. */
  const release = useCallback(() => {
    const current = streamRef.current
    if (!current) return
    streamRef.current = null
    current.getTracks().forEach((track) => {
      track.onended = null
      track.stop()
    })
  }, [])

  /** The camera was unplugged or taken away while running. */
  const handleTrackEnded = useCallback(() => {
    release()
    if (!mountedRef.current) return
    setStream(null)
    setStatus('unavailable')
  }, [release])

  const start = useCallback(async () => {
    if (streamRef.current || startingRef.current) return

    // mediaDevices is missing when the page is not on localhost/https.
    if (typeof navigator.mediaDevices?.getUserMedia !== 'function') {
      setStatus('unavailable')
      return
    }

    const request = ++generation.current
    startingRef.current = true
    setStatus('loading')

    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })

      // The app went away while the permission prompt was open: do not keep the camera.
      if (!mountedRef.current || request !== generation.current) {
        media.getTracks().forEach((track) => track.stop())
        return
      }

      media.getTracks().forEach((track) => {
        track.onended = handleTrackEnded
      })
      streamRef.current = media
      setStream(media)
      setStatus('ready')
    } catch (error) {
      if (mountedRef.current && request === generation.current) setStatus(statusForError(error))
    } finally {
      if (request === generation.current) startingRef.current = false
    }
  }, [handleTrackEnded])

  // Teardown: stop the camera when App unmounts.
  // Resetting state here also makes development hot-reloads restart the camera
  // instead of leaving a frozen video that points at a stopped stream.
  useEffect(() => {
    mountedRef.current = true
    return () => {
      generation.current += 1
      startingRef.current = false
      mountedRef.current = false
      release()
      setStream(null)
      setStatus('idle')
    }
  }, [release])

  const stop = useCallback(() => {
    generation.current += 1
    startingRef.current = false
    release()
    setStream(null)
    setStatus('idle')
  }, [release])
  return { status, stream, start, stop }
}
