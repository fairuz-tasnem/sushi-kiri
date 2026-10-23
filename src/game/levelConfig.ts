/**
 * The five levels of Sushi Kiri: what the player has to score, how long a level lasts, and how
 * hard it is. Only numbers live here (plus one small lookup), so a level is tuned by editing a
 * number in the table below, never by touching game logic.
 *
 * Read by levelProgress.ts and GameCanvas.tsx (Day 5, part 2), which play one level at a time with
 * its clock, spawn waits and object speeds. Score restarts at 0 in every level.
 *
 * Same conventions as gameConfig.ts:
 *   - times are in seconds, speeds are per second
 *   - sideways speed is in canvas WIDTHS per second, and gravity is per pixel of canvas HEIGHT,
 *     so a level feels the same in a small window and a big one
 *
 * What changes from level to level
 * --------------------------------
 *   targetScore            Points needed to pass the level. It is only a number here: whether the
 *                          score restarts at 0 for each level or keeps adding up is decided later,
 *                          together with the rest of the level-switching rules.
 *   durationSeconds        How long the level lasts. LEVEL_DURATION_SECONDS below sets all five.
 *   spawnIntervalSeconds   SPAWN RATE. Seconds between two launches; each wait is picked at random
 *                          from { min, max }. A SHORTER wait means MORE objects, so these numbers go
 *                          DOWN as the levels go up. The average wait is (min + max) / 2.
 *   gravityPerHeight       OBJECT SPEED, up and down. Higher gravity throws an object up faster and
 *                          brings it down faster, to the same height, so it spends less time on
 *                          screen. The numbers go UP with the level.
 *   horizontalSpeedWidths  OBJECT SPEED, sideways. How fast an object drifts across the screen.
 *                          The numbers go UP with the level.
 *
 * Everything else about how objects are thrown (peak height, lives, points, soy sauce, wasabi,
 * the limit on objects on screen) stays in gameConfig.ts and is the same on every level. Note that
 * maxObjectsOnScreen still applies: if you make the waits very short, launches are skipped
 * (not queued) while the screen is full.
 *
 * The three tuning fields below are taken from GameConfig on purpose (see LevelTuning), so their
 * names and units cannot drift away from what the game already reads. Level 1 uses the same
 * numbers as gameConfig.ts today, so it plays like the game does now.
 *
 * These are starting values to be tuned by playing, not final numbers.
 */

import type { GameConfig } from './gameConfig'

/** Every level lasts this many seconds. Change it here for all five, or give one level its own number below. */
export const LEVEL_DURATION_SECONDS = 60

/**
 * The gameConfig.ts fields a level is allowed to change. They are picked FROM GameConfig, so each
 * has exactly the same name and unit as in gameConfig.ts and means exactly the same thing.
 */
export type LevelTuning = Pick<
  GameConfig,
  'spawnIntervalSeconds' | 'gravityPerHeight' | 'horizontalSpeedWidths'
>

export interface LevelConfig extends LevelTuning {
  /** The level's number, 1 to 5, as shown to the player. */
  level: number
  /** Points needed to pass the level. */
  targetScore: number
  /** How long the level lasts, in seconds. */
  durationSeconds: number
}

/** The levels, in play order: levelConfigs[0] is level 1. */
export const levelConfigs: readonly LevelConfig[] = [
  {
    level: 1,
    targetScore: 100,
    durationSeconds: LEVEL_DURATION_SECONDS,
    spawnIntervalSeconds: { min: 0.8, max: 1.6 },
    gravityPerHeight: 1.1,
    horizontalSpeedWidths: { min: 0.05, max: 0.2 },
  },
  {
    level: 2,
    targetScore: 180,
    durationSeconds: LEVEL_DURATION_SECONDS,
    spawnIntervalSeconds: { min: 0.725, max: 1.45 },
    gravityPerHeight: 1.25,
    horizontalSpeedWidths: { min: 0.06, max: 0.22 },
  },
  {
    level: 3,
    targetScore: 260,
    durationSeconds: LEVEL_DURATION_SECONDS,
    spawnIntervalSeconds: { min: 0.65, max: 1.3 },
    gravityPerHeight: 1.4,
    horizontalSpeedWidths: { min: 0.07, max: 0.24 },
  },
  {
    level: 4,
    targetScore: 350,
    durationSeconds: LEVEL_DURATION_SECONDS,
    spawnIntervalSeconds: { min: 0.575, max: 1.15 },
    gravityPerHeight: 1.55,
    horizontalSpeedWidths: { min: 0.08, max: 0.26 },
  },
  {
    level: 5,
    targetScore: 450,
    durationSeconds: LEVEL_DURATION_SECONDS,
    spawnIntervalSeconds: { min: 0.5, max: 1.0 },
    gravityPerHeight: 1.7,
    horizontalSpeedWidths: { min: 0.09, max: 0.28 },
  },
]

/** The settings of one level (1 to 5), or undefined if there is no such level. */
export function getLevelConfig(level: number): LevelConfig | undefined {
  return levelConfigs.find((config) => config.level === level)
}
