import type { TrackingStatus } from './useHandTracker'

/** What the player sees for each hand-tracking state (see TrackingNotice). 'idle' shows nothing. */
export const TRACKING_TEXT: Record<Exclude<TrackingStatus, 'idle'>, { title: string; help: string }> = {
  loading: {
    title: 'Loading hand tracking…',
    help: 'The hand model is starting. The first time this can take a few seconds while it downloads.',
  },
  'no-hand': {
    title: 'Hand not detected',
    help: 'Hold one hand up in front of the camera so it is clearly visible.',
  },
  tracking: {
    title: 'Hand detected',
    help: 'The cursor follows the tip of your index finger.',
  },
  unavailable: {
    title: 'Hand tracking unavailable',
    help: 'The hand model could not be loaded. Check your internet connection (the model downloads the first time), then press Try tracking again.',
  },
}
