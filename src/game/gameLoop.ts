/**
 * The game loop: once per screen refresh it calls update(dt), then render().
 *
 * `dt` is the time since the previous frame, in SECONDS. Everything that moves
 * multiplies its speed by dt, so a sushi travels the same distance per second on a
 * 60 Hz screen, a 144 Hz screen, or a slow laptop.
 *
 * Rules this file guarantees:
 *   - start() while already running does nothing, so there can never be two loops.
 *   - stop() cancels the pending frame, so nothing runs after it.
 *   - the next frame is only scheduled after the current one has finished.
 *   - dt is capped, so coming back to a hidden tab (when the browser pauses
 *     requestAnimationFrame) does not make things jump.
 *
 * No React in here: GameCanvas.tsx starts and stops it.
 */

export interface GameLoopCallbacks {
  /** Move things. `deltaSeconds` is 0 on the very first frame after start(). */
  update: (deltaSeconds: number) => void
  /** Draw the current state. */
  render: () => void
}

export interface GameLoop {
  start: () => void
  stop: () => void
}

/** The longest time step the game will simulate in one frame (20 frames per second). */
const MAX_DELTA_SECONDS = 0.05

export function createGameLoop({ update, render }: GameLoopCallbacks): GameLoop {
  let running = false
  let handle = 0
  let lastTime: number | null = null

  const frame = (now: number) => {
    handle = 0
    if (!running) return

    const delta = lastTime === null ? 0 : Math.max(0, Math.min((now - lastTime) / 1000, MAX_DELTA_SECONDS))
    lastTime = now

    try {
      update(delta)
      render()
    } catch (error) {
      running = false // an error ends this loop; the error itself still reaches the console
      throw error
    }

    if (running) handle = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      lastTime = null // the first frame only records the time; it does not move anything
      handle = requestAnimationFrame(frame)
    },

    stop() {
      running = false
      if (handle) cancelAnimationFrame(handle)
      handle = 0
      lastTime = null
    },
  }
}
