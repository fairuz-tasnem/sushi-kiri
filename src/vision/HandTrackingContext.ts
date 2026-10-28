import { createContext, useContext } from 'react'
import type { HandTrackingState } from './useHandTracker'

/** Lets any screen read the hand-tracking status that App.tsx owns, without passing props through every screen. */
export const HandTrackingContext = createContext<HandTrackingState | null>(null)

export function useHandTracking(): HandTrackingState {
  const tracking = useContext(HandTrackingContext)
  if (!tracking) {
    throw new Error('useHandTracking must be used inside <HandTrackingContext.Provider> (see App.tsx).')
  }
  return tracking
}
