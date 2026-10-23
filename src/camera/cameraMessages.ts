import type { CameraStatus } from './useCameraStream'

/** One short line for the small preview box, which is only about 11rem wide. */
export const PREVIEW_TEXT: Record<CameraStatus, string> = {
  idle: 'Camera preview appears here',
  loading: 'Starting camera…',
  ready: 'Camera ready',
  denied: 'Camera blocked',
  unavailable: 'No camera found',
}

/** Longer explanations, shown on screens that have room (see CameraNotice). */
export const NOTICE_TEXT = {
  loading: {
    title: 'Starting your camera…',
    help: 'Your browser may ask for permission. Choose Allow to continue.',
  },
  denied: {
    title: 'Camera permission was blocked',
    help: 'Sushi Kiri needs your camera. Click the camera or lock icon next to the web address, set Camera to Allow, then press Try camera again.',
  },
  unavailable: {
    title: 'Camera not available',
    help: 'No camera was found, or another app is using it. Plug the camera in, close other apps that use it, then press Try camera again. The camera only works on localhost or https addresses.',
  },
} as const
