/**
 * Coordinate mapping for hand tracking. Pure maths, no React and no DOM access,
 * so it is easy to reason about and to test.
 *
 * The problem: MediaPipe reports a fingertip as two numbers between 0 and 1,
 * measured on the RAW camera frame (0,0 = top-left, 1,1 = bottom-right, and the
 * picture is NOT mirrored). The player never sees that raw frame. They see the
 * <video> element, which the page changes in two ways (see .webcam__video in
 * components.css):
 *
 *   1. object-fit: cover  scales the picture until it fills the element, then
 *                         crops whatever sticks out, equally on both sides.
 *   2. transform: scaleX(-1)  flips it left-to-right, like a mirror.
 *
 * To put a cursor on the fingertip the player sees, we apply the same two steps
 * to the point, in the same order.
 */

/** A point measured in the camera frame: x and y are fractions from 0 to 1. */
export interface NormalizedPoint {
  x: number
  y: number
}

/** A point in CSS pixels, relative to the browser window (same space as getBoundingClientRect). */
export interface ScreenPoint {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/** The on-screen box of the <video> element, as returned by getBoundingClientRect(). */
export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

export interface MapOptions {
  /** True when the video is flipped with scaleX(-1), which is how the game shows it. Default true. */
  mirrored?: boolean
}

/**
 * Converts a fingertip position in the raw camera frame into window pixels.
 *
 * @param point       the fingertip, normalized 0..1 on the raw (unmirrored) frame
 * @param videoSize   the camera frame's real size (video.videoWidth / videoHeight)
 * @param displayRect where the <video> element sits on screen (getBoundingClientRect)
 * @returns the pixel position, or null if either size is zero (video not showing yet).
 *          The result can fall OUTSIDE displayRect when the fingertip is in a part of
 *          the picture that object-fit: cover cropped away. Use isInsideRect to check.
 */
export function mapVideoPointToScreen(
  point: NormalizedPoint,
  videoSize: Size,
  displayRect: ScreenRect,
  { mirrored = true }: MapOptions = {},
): ScreenPoint | null {
  if (
    videoSize.width <= 0 ||
    videoSize.height <= 0 ||
    displayRect.width <= 0 ||
    displayRect.height <= 0
  ) {
    return null
  }

  // object-fit: cover. One scale factor for both axes (the picture is never
  // stretched), large enough that the picture covers the whole element.
  const scale = Math.max(displayRect.width / videoSize.width, displayRect.height / videoSize.height)
  const shownWidth = videoSize.width * scale
  const shownHeight = videoSize.height * scale

  // The picture is centred (object-position: 50% 50%), so the overflow is cropped
  // equally from both sides. At least one of these two is zero.
  const cropX = (shownWidth - displayRect.width) / 2
  const cropY = (shownHeight - displayRect.height) / 2

  // Position inside the element, before mirroring.
  let x = point.x * shownWidth - cropX
  const y = point.y * shownHeight - cropY

  // scaleX(-1) flips the element around its own centre, so x becomes width - x.
  if (mirrored) x = displayRect.width - x

  return { x: displayRect.left + x, y: displayRect.top + y }
}

/** True when the point lies within the rectangle (edges included). */
export function isInsideRect(point: ScreenPoint, rect: ScreenRect): boolean {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  )
}
