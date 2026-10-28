/**
 * The level lifecycle (Day 5, part 2): how a level starts, how it ends, and what carries over to
 * the next one.
 *
 * Pure game logic. No React, no DOM, no timers of its own. GameCanvas.tsx creates one LevelClock
 * when the Playing screen opens, counts it down from the EXISTING game loop's update() (so there
 * is no second timer or loop, and a stopped loop means a stopped clock), and asks
 * evaluateLevel() after every change that could end the level.
 *
 * The rules
 * ---------
 *   - A level starts with its own `durationSeconds` on the clock, and its own spawn waits and
 *     object speeds (levelGameConfig below).
 *   - The score is PER LEVEL: every level starts at 0 and is compared with that level's target.
 *     (Decision for this part; the level table leaves it open.)
 *   - evaluateLevel decides the ending in this order, so exactly one outcome can win:
 *       1. no lives left          -> 'gameOver'   (beats everything, even a target reached by
 *                                                  the same swipe)
 *       2. score >= target        -> 'complete' (levels 1-4) or 'victory' (the last level)
 *       3. clock at 0             -> 'failed'
 *       otherwise null: keep playing.
 *   - Lives carry over after 'complete'. After 'failed' the retry starts with full lives.
 *     After 'gameOver' the next run starts at level 1 with full lives.
 *
 * "At most once": a level ends through ONE guard in GameCanvas (`ended`). This file only answers
 * "has it ended, and how?"; it never changes anything but the clock.
 */

import type { GameConfig } from './gameConfig'
// '.ts' on purpose: the tests run this file directly in Node, which needs the full file name.
import { getLevelConfig, levelConfigs } from './levelConfig.ts'
import type { LevelConfig } from './levelConfig'

/** How a level ended. */
export type LevelOutcome = 'complete' | 'victory' | 'failed' | 'gameOver'

/** What the Playing screen reports, once, when its level ends. */
export interface LevelResult {
  outcome: LevelOutcome
  /** The level that was played (1 to 5). */
  level: number
  /** Score reached in that level (starts at 0 each level). */
  score: number
  /** The level's target score. */
  target: number
  /** Lives left when it ended. */
  livesLeft: number
}

/** Which level to play next and how many lives it starts with. */
export interface RunSetup {
  level: number
  lives: number
}

/** Same floating-point guard as the soy sauce clock in scoring.ts. */
const EXPIRY_EPSILON = 1e-6

export interface LevelClock {
  /** Seconds left. Only goes down, and never below 0. */
  remaining: number
}

export const LAST_LEVEL = levelConfigs.length

export function isLastLevel(level: number): boolean {
  return level >= LAST_LEVEL
}

export function createLevelClock(level: LevelConfig): LevelClock {
  return { remaining: level.durationSeconds }
}

/** Counts the level clock down by one frame. Call once per update. Ignores bad or negative steps. */
export function tickLevelClock(clock: LevelClock, deltaSeconds: number): void {
  if (!(deltaSeconds > 0) || clock.remaining <= 0) return
  const left = clock.remaining - deltaSeconds
  clock.remaining = left > EXPIRY_EPSILON ? left : 0
}

export function isTimeUp(clock: LevelClock): boolean {
  return clock.remaining <= 0
}

/** The whole seconds shown to the player: 60 at the start, 1 until the last moment, then 0. */
export function secondsLeftForDisplay(clock: LevelClock): number {
  return Math.max(0, Math.ceil(clock.remaining - EXPIRY_EPSILON))
}

/** Has this level ended, and how? null means it is still being played. See the rules above. */
export function evaluateLevel(
  level: LevelConfig,
  state: { score: number; lives: number },
  clock: LevelClock,
): LevelOutcome | null {
  if (state.lives <= 0) return 'gameOver'
  if (state.score >= level.targetScore) return isLastLevel(level.level) ? 'victory' : 'complete'
  if (isTimeUp(clock)) return 'failed'
  return null
}

/**
 * The GameConfig one level is played with: the shared numbers from gameConfig.ts, with the level's
 * own spawn waits and object speeds on top, and `lives` as the starting lives (so carried-over
 * lives work). Returns a NEW object; gameConfig itself is never changed.
 */
export function levelGameConfig(base: GameConfig, level: LevelConfig, lives: number): GameConfig {
  return {
    ...base,
    spawnIntervalSeconds: level.spawnIntervalSeconds,
    gravityPerHeight: level.gravityPerHeight,
    horizontalSpeedWidths: level.horizontalSpeedWidths,
    startingLives: lives,
  }
}

/** A new run: level 1, full lives. */
export function newRun(fullLives: number): RunSetup {
  return { level: 1, lives: fullLives }
}

/**
 * What to play after a finished level.
 *   complete -> the next level, with the lives that were left
 *   failed   -> the same level again, with full lives
 * Anything else (gameOver, victory) ends the run, so it returns a fresh one.
 */
export function nextRunSetup(result: LevelResult, fullLives: number): RunSetup {
  switch (result.outcome) {
    case 'complete':
      return { level: Math.min(result.level + 1, LAST_LEVEL), lives: Math.max(1, result.livesLeft) }
    case 'failed':
      return { level: result.level, lives: fullLives }
    case 'gameOver':
    case 'victory':
      return newRun(fullLives)
  }
}

/** The level table entry for a level number, falling back to level 1 for a bad number. */
export function levelOrFirst(level: number): LevelConfig {
  return getLevelConfig(level) ?? levelConfigs[0]
}
