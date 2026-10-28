import type { Sushi } from './sushi'
export const DESCENT_SECONDS = 3.6
/** Only visual physics runs here. No spawner, score, collision or level clock. */
export function descendObjects(objects: Sushi[], dt: number, progress: number) {
  const step = Math.min(.05, Math.max(0, dt)) * (1 - .55 * Math.min(1, progress))
  for (const object of objects) {
    object.vx *= Math.exp(-2 * step)
    object.vy *= Math.exp(-2.8 * step)
    object.vy += object.gravity * .7 * step
    object.x += object.vx * step
    object.y += object.vy * step
    object.angle += object.spin * step * .35
    if (object.slice) object.slice.age += step
  }
}
