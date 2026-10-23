import { useHandTracking } from '../vision/HandTrackingContext'
import { TRACKING_TEXT } from '../vision/trackingMessages'
import Button from './Button'

/**
 * Says what hand tracking is doing: loading, hand detected, hand not detected, or
 * unavailable (with a retry button). Renders nothing while the camera is not running,
 * because CameraNotice already explains that, so it is safe to place on any screen.
 */
export default function TrackingNotice() {
  const { status, retry } = useHandTracking()

  if (status === 'idle') return null

  const text = TRACKING_TEXT[status]

  return (
    <div
      className="note camera-notice tracking-notice"
      data-state={status}
      role={status === 'unavailable' ? 'alert' : 'status'}
    >
      <p className="camera-notice__title">{text.title}</p>
      <p>{text.help}</p>
      {status === 'unavailable' && <Button onClick={retry}>Try tracking again</Button>}
    </div>
  )
}
