/**
 * Keeps the Canvas sharp at any window size.
 *
 * A canvas has two sizes:
 *   - its CSS size: how big it looks on the page (the whole window here, see .game-canvas)
 *   - its pixel size: how many pixels it really has (canvas.width / canvas.height)
 * If the pixel size is smaller than what the screen shows, the picture is blurry.
 * On a high-density screen (devicePixelRatio 2) the canvas needs twice as many pixels.
 *
 * Game code never sees that: it works in CSS pixels, with (0, 0) at the top-left of
 * the window, so it can use the same numbers as the rest of the page. renderFrame()
 * applies the pixel ratio as a scale before it draws.
 */

export interface CanvasView {
  /** Canvas width in CSS pixels (the width of the play area). */
  width: number
  /** Canvas height in CSS pixels (the height of the play area). */
  height: number
  /** Real pixels per CSS pixel. */
  pixelRatio: number
}

/** Very dense screens would need huge canvases for little visible gain, so cap the ratio. */
const MAX_PIXEL_RATIO = 2

export function createCanvasView(): CanvasView {
  return { width: 0, height: 0, pixelRatio: 1 }
}

/** True once the canvas has a real size (it is 0 x 0 while hidden). */
export function hasArea(view: CanvasView): boolean {
  return view.width > 0 && view.height > 0
}

/**
 * Reads how big the canvas is on screen right now, resizes its pixel buffer to
 * match, and writes the result into `view`. Call it on mount and on every resize.
 * Note: changing canvas.width or canvas.height erases the canvas, so draw again afterwards.
 */
export function syncCanvasSize(canvas: HTMLCanvasElement, view: CanvasView): void {
  const rect = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)

  const pixelWidth = Math.round(rect.width * pixelRatio)
  const pixelHeight = Math.round(rect.height * pixelRatio)
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight

  view.width = rect.width
  view.height = rect.height
  view.pixelRatio = pixelRatio
}
