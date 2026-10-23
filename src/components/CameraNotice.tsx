import { useCamera } from '../camera/CameraContext'
import { NOTICE_TEXT } from '../camera/cameraMessages'
import Button from './Button'

/**
 * Explains a camera problem (or that the camera is starting) in full sentences,
 * with a retry button when something went wrong. Renders nothing while the
 * camera is idle or working, so it is safe to place on any screen.
 */
export default function CameraNotice() {
  const { status, start } = useCamera()

  if (status !== 'loading' && status !== 'denied' && status !== 'unavailable') return null

  const text = NOTICE_TEXT[status]

  return (
    <div className="note camera-notice" role={status === 'loading' ? 'status' : 'alert'}>
      <p className="camera-notice__title">{text.title}</p>
      <p>{text.help}</p>
      {status !== 'loading' && <Button onClick={() => void start()}>Try camera again</Button>}
    </div>
  )
}
