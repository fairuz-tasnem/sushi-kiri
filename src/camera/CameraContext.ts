import { createContext, useContext } from 'react'
import type { CameraState } from './useCameraStream'

/** Lets any component read the camera that App.tsx owns, without passing props through every screen. */
export const CameraContext = createContext<CameraState | null>(null)

export function useCamera(): CameraState {
  const camera = useContext(CameraContext)
  if (!camera) {
    throw new Error('useCamera must be used inside <CameraContext.Provider> (see App.tsx).')
  }
  return camera
}
