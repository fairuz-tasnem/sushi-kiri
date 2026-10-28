import type { NormalizedPoint } from './coordinateMapper'
/** Speed-adaptive low-pass filter: steady pointing is damped; fast swipes catch up. */
export function smoothPoint(previous: NormalizedPoint, next: NormalizedPoint, elapsedMs: number): NormalizedPoint {
  const distance = Math.hypot(next.x - previous.x, next.y - previous.y)
  const speed = distance / Math.max(.001, elapsedMs / 1000)
  const timeConstant = 45 - 33 * Math.min(1, speed / 1.8)
  const alpha = 1 - Math.exp(-Math.max(0, elapsedMs) / timeConstant)
  return { x: previous.x + alpha * (next.x - previous.x), y: previous.y + alpha * (next.y - previous.y) }
}
