/**
 * Sushi spawner (Task 2; soy sauce added in Task 3, wasabi in Task 4): decides WHEN a new object
 * is launched and WHICH one (usually a sushi, now and then a soy sauce bottle or a wasabi), keeps the list of every object
 * currently flying, moves them all each frame, and removes the finished ones.
 *
 * Pure game logic. No React, no DOM, no drawing. GameCanvas.tsx creates one spawner when the
 * Playing screen opens and calls updateSushiSpawner once per frame from the existing game
 * loop (gameLoop.ts), passing the frame's `deltaSeconds`.
 *
 * Why it stops by itself outside the Playing state
 * -------------------------------------------------
 * Nothing in here has a clock of its own: the spawn timer and every sushi only advance when
 * updateSushiSpawner is called, and the game loop calls it only while GameCanvas exists.
 * GameCanvas exists only on the 'game' screen, so on Pause, Game Over, or any other screen the
 * loop is stopped, no spawn happens and nothing moves. When the Playing screen opens again a
 * NEW spawner is created, so the field starts empty and nothing carries over.
 * (Keeping the field alive across a pause and resuming it exactly is a later task.)
 */

import type { CanvasView } from './canvasView'
import type { GameConfig } from './gameConfig'
import {
  getSoySauceType,
  getSushiTypes,
  getWasabiType,
  isSushiFinished,
  spawnSushi,
  updateSushi,
} from './sushi'
import type { RandomFn, Sushi, SushiType } from './sushi'

export interface SushiSpawner {
  /**
   * Every sushi that is currently flying, oldest first. This array is created once and only
   * ever changed in place (push and splice), never replaced, so the reference GameCanvas hands
   * to the renderer and to slicing stays valid for the whole session.
   */
  readonly sushi: Sushi[]
  /** Seconds until the next launch. */
  timeUntilNextSpawn: number
  /** The sushi kinds that can be launched (from the asset manifest). */
  readonly types: readonly SushiType[]
  /** The soy sauce bottle, or null if the manifest has none (then no bottle is ever launched). */
  readonly soyType: SushiType | null
  /** The wasabi, or null if the manifest has none (then no wasabi is ever launched). */
  readonly wasabiType: SushiType | null
}

export function createSushiSpawner(config: GameConfig): SushiSpawner {
  return {
    sushi: [],
    timeUntilNextSpawn: config.firstSpawnDelaySeconds,
    types: getSushiTypes(),
    soyType: getSoySauceType(),
    wasabiType: getWasabiType(),
  }
}

/**
 * Advances everything by one frame, in this order:
 *   1. move every existing sushi
 *   2. remove the ones that are finished (so the list cannot grow without limit)
 *   3. count the spawn timer down and, when it reaches zero, launch one new sushi
 *
 * A sushi launched in step 3 is not moved until the next frame, so every sushi's first
 * visible frame is the one it was launched on.
 */
export function updateSushiSpawner(
  spawner: SushiSpawner,
  deltaSeconds: number,
  view: CanvasView,
  config: GameConfig,
  random: RandomFn = Math.random,
): void {
  const { sushi } = spawner

  for (const item of sushi) updateSushi(item, deltaSeconds)

  // Walk backwards so removing one entry does not shift the ones still to be checked.
  for (let i = sushi.length - 1; i >= 0; i -= 1) {
    if (isSushiFinished(sushi[i], view, config)) sushi.splice(i, 1)
  }

  spawner.timeUntilNextSpawn -= deltaSeconds
  if (spawner.timeUntilNextSpawn > 0) return

  // Time for the next launch. The following one is scheduled whether or not this one happens,
  // so a full screen skips a launch instead of building up a queue that would burst out later.
  spawner.timeUntilNextSpawn = randomInterval(config, random)
  if (sushi.length >= config.maxObjectsOnScreen) return

  const type = pickType(spawner, config, random)
  if (type) sushi.push(spawnSushi(type, view, config, random))
}

/**
 * Chooses what to launch. ONE random number decides it, laid out like a strip:
 *
 *   [ soy sauce | wasabi | sushi .................................. ]
 *     soy chance  wasabi chance   the rest
 *
 * so each special object appears with exactly its own configured chance, and the two do not
 * disturb each other. A special object takes part only while fewer than its `max...OnScreen`
 * are in the air (otherwise its slice of the strip goes to sushi) and only if the manifest has
 * it. Returns null only when there is nothing to launch at all (an empty manifest).
 */
function pickType(spawner: SushiSpawner, config: GameConfig, random: RandomFn): SushiType | null {
  let bottles = 0
  let wasabi = 0
  for (const item of spawner.sushi) {
    if (item.type.kind === 'soySauce') bottles += 1
    else if (item.type.kind === 'wasabi') wasabi += 1
  }

  const soyChance = spawner.soyType && bottles < config.maxSoySauceOnScreen ? config.soySauceSpawnChance : 0
  const wasabiChance = spawner.wasabiType && wasabi < config.maxWasabiOnScreen ? config.wasabiSpawnChance : 0

  if (soyChance > 0 || wasabiChance > 0) {
    const roll = random()
    if (spawner.soyType && roll < soyChance) return spawner.soyType
    if (spawner.wasabiType && roll >= soyChance && roll < soyChance + wasabiChance) return spawner.wasabiType
  }

  if (spawner.types.length === 0) return null
  return spawner.types[Math.floor(random() * spawner.types.length)]
}

function randomInterval(config: GameConfig, random: RandomFn): number {
  const { min, max } = config.spawnIntervalSeconds
  return min + (max - min) * random()
}
