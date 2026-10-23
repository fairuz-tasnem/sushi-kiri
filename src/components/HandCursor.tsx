import { useEffect, useRef } from 'react'
import { isInsideRect, mapVideoPointToScreen } from '../vision/coordinateMapper'
import type { HandTrackingState } from '../vision/useHandTracker'

interface HandCursorProps {
  /** The one <video> element that shows the camera. The cursor is placed relative to it. */
  video: HTMLVideoElement | null
  subscribe: HandTrackingState['subscribe']
  /** Only the Calibration and Playing screens show the cursor; tracking itself keeps running everywhere. */
  visible: boolean
}

/** The cursor scales with the picture it is on: small over the corner preview, larger over the full-window video. */
function cursorSizeFor(videoWidth: number): number {
  return Math.min(30, Math.max(18, Math.round(videoWidth * 0.03)))
}

/**
 * A high-contrast dot drawn over the player's index fingertip.
 *
 * It is a fixed-position overlay on top of everything (see .hand-cursor), so it is
 * visible over the full-window video on the Playing screen even where the game card
 * sits, and over the small camera preview on the Calibration screen.
 *
 * Fingertip readings arrive up to 60 times a second, so the position is written
 * straight to the element instead of going through React state. The element is
 * hidden whenever tracking is lost, or the fingertip is in a part of the picture
 * that object-fit: cover has cropped off the screen.
 */
export default function HandCursor({ video, subscribe, visible }: HandCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    if (!cursor || !video) return

    let shownSize = 0
    const hide = () => {
      cursor.style.visibility = 'hidden'
    }

    const unsubscribe = subscribe((sample) => {
      if (!sample) {
        hide()
        return
      }

      // Read the video's size and position NOW, so the cursor stays correct when the
      // video moves between the corner preview and the full-window background.
      const rect = video.getBoundingClientRect()
      const position = mapVideoPointToScreen(
        sample.point,
        { width: video.videoWidth, height: video.videoHeight },
        rect,
      )
      if (!position || !isInsideRect(position, rect)) {
        hide()
        return
      }

      const size = cursorSizeFor(rect.width)
      if (size !== shownSize) {
        shownSize = size
        cursor.style.setProperty('--cursor-size', `${size}px`)
      }
      cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`
      cursor.style.visibility = 'visible'
    })

    return () => {
      unsubscribe()
      hide()
    }
  }, [video, subscribe])

  return <div ref={cursorRef} className="hand-cursor" hidden={!visible} aria-hidden="true" />
}
