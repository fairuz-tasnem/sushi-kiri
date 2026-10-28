import { useEffect, useRef } from 'react'
import { useCamera } from '../camera/CameraContext'
import { PREVIEW_TEXT } from '../camera/cameraMessages'

interface WebcamPreviewProps {
  /** True on the Playing screen: the live video fills the whole window behind the game. */
  background?: boolean
  /**
   * Called with the one <video> element once it exists, and with null if it goes away.
   * Hand tracking reads this same element, so no second camera stream is ever opened.
   */
  onVideoElement?: (video: HTMLVideoElement | null) => void
}

/**
 * The live camera picture. It is rendered once, by App, and never unmounted,
 * so switching between the small corner preview and the full-window background
 * only changes CSS classes; the video does not restart.
 *
 * Before the camera has started it shows the original placeholder text, and
 * a short status message while loading, blocked or unavailable.
 * The video is mirrored in CSS (.webcam__video) so it behaves like a mirror.
 */
export default function WebcamPreview({ background = false, onVideoElement }: WebcamPreviewProps) {
  const { status, stream } = useCamera()
  const videoRef = useRef<HTMLVideoElement>(null)
  const live = status === 'ready' && stream !== null

  // Connect the stream to the <video>, and disconnect it when the stream goes away.
  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    return () => {
      video.srcObject = null
    }
  }, [stream])

  // Tell the owner (App) which <video> element this is.
  useEffect(() => {
    onVideoElement?.(videoRef.current)
    return () => onVideoElement?.(null)
  }, [onVideoElement])

  const classes = ['webcam', live && 'webcam--live', background && 'webcam--background']
    .filter(Boolean)
    .join(' ')

  return (
    <aside
      className={classes}
      aria-label={status === 'idle' ? 'Camera preview placeholder' : 'Camera preview'}
    >
      <div className="webcam__frame">
        <video ref={videoRef} className="webcam__video" autoPlay muted playsInline hidden={!live} />
        {!live && <p className="webcam__text">{PREVIEW_TEXT[status]}</p>}
      </div>
    </aside>
  )
}
