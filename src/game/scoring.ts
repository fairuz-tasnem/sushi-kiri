/**
 * The rules of a game (Tasks 3 and 4): what a cut object is worth, how long the double-points
 * bonus lasts, how many lives are left, and when the game is over.
 *
 * Pure game logic. No React, no DOM, no drawing, no sound, no timers of its own. GameCanvas.tsx
 * creates one ScoreState when the Playing screen opens, calls updateScoreState from the existing
 * game loop with the frame's `deltaSeconds` (so the bonus counts down in game time, in the same
 * loop as everything else), and passes every object a swipe has cut to resolveCuts.
 *
 * The rules
 * ---------
 *   - A new ScoreState has score 0, no bonus, and `startingLives` (3) lives. A new game is a new
 *     ScoreState, so nothing carries over from the game before.
 *   - Cutting a sushi adds `pointsPerSushi`, multiplied by `soySauceMultiplier` (2) if the
 *     soy sauce bonus is running at that moment. The multiplier applies to nothing else.
 *   - Cutting a soy sauce bottle starts the bonus: `soySauceDurationSeconds` (5) left on the
 *     clock. The bottle itself scores nothing. A SECOND bottle cut while the bonus is running
 *     restarts the clock; the multiplier does not stack.
 *   - Cutting a wasabi removes exactly ONE life. It never touches the score or the bonus.
 *   - Lives never go below 0. At 0 the game is over (isGameOver) and from then on nothing is
 *     applied any more: no points, no bonus, no further life loss.
 *   - The bonus clock only goes down, to 0, and then the bonus is over.
 *
 * Once-only guards (two independent ones)
 * ---------------------------------------
 *   1. slicing.ts: an object that has been cut can never be cut again, so only one swipe is
 *      ever handed to resolveCuts for it.
 *   2. applyCut below: it refuses an object that was never cut and one that is already
 *      `claimed`, and marks the object `claimed` before it does anything. So even if the same
 *      object reached applyCut twice, its points could not be added twice, a bottle could not
 *      start the bonus twice, and a wasabi could not take a second life.
 */

import type { GameConfig } from './gameConfig'
import type { Sushi } from './sushi'

export interface ScoreState {
  score: number
  /** Seconds of soy sauce bonus left. 0 means there is no bonus. */
  soyRemaining: number
  /** Lives left. 0 means the game is over. */
  lives: number
}

/** What applying one cut gave. null means nothing was applied (the object was refused). */
export type CutResult =
  | { kind: 'sushi'; points: number }
  | { kind: 'soySauce' }
  | { kind: 'wasabi'; livesLeft: number }
  | null

/** Points given to one sushi, so the caller can show a popup where it was cut. */
export interface ScoreAward {
  sushi: Sushi
  points: number
}

/**
 * Everything one swipe changed, for the feedback the caller shows. resolveCuts empties and
 * refills it on every call; the caller creates ONE and reuses it.
 */
export interface CutOutcome {
  /** One entry per sushi that scored. */
  awards: ScoreAward[]
  /** One entry per wasabi that took a life. */
  wasabiHits: Sushi[]
}

/**
 * Floating-point sums of many small frame times can leave a tiny leftover (like 0.0000000000001)
 * when the bonus should be exactly over. Anything below this counts as 0, so the bonus never
 * lasts one extra frame because of rounding.
 */
const EXPIRY_EPSILON = 1e-6

/** The state of a brand-new game: score 0, no bonus, full lives. */
export function createScoreState(config: GameConfig): ScoreState {
  return { score: 0, soyRemaining: 0, lives: config.startingLives }
}

export function createCutOutcome(): CutOutcome {
  return { awards: [], wasabiHits: [] }
}

export function isSoyBonusActive(state: ScoreState): boolean {
  return state.soyRemaining > 0
}

/** True when no lives are left. */
export function isGameOver(state: ScoreState): boolean {
  return state.lives <= 0
}

/** What a sushi's points are multiplied by right now. */
export function currentMultiplier(state: ScoreState, config: GameConfig): number {
  return isSoyBonusActive(state) ? config.soySauceMultiplier : 1
}

/** Counts the bonus down by one frame. Call once per update; does nothing when there is no bonus. */
export function updateScoreState(state: ScoreState, deltaSeconds: number): void {
  if (state.soyRemaining <= 0) return
  const left = state.soyRemaining - deltaSeconds
  state.soyRemaining = left > EXPIRY_EPSILON ? left : 0
}

/**
 * Applies the effect of ONE cut object: points for a sushi, the bonus for a soy sauce bottle,
 * one lost life for a wasabi. Returns null, and changes nothing, for an object that was not cut,
 * that was already claimed, or when the game is already over.
 */
export function applyCut(state: ScoreState, object: Sushi, config: GameConfig): CutResult {
  if (isGameOver(state)) return null // the game has ended: nothing counts any more
  if (object.slice === null) return null // never cut: nothing to apply
  if (object.claimed) return null // its effect was already given
  object.claimed = true

  switch (object.type.kind) {
    case 'soySauce':
      state.soyRemaining = config.soySauceDurationSeconds // start, or restart; never add to it
      return { kind: 'soySauce' }

    case 'wasabi':
      state.lives = Math.max(0, state.lives - 1) // exactly one, and never below 0
      return { kind: 'wasabi', livesLeft: state.lives }

    case 'sushi': {
      const points = config.pointsPerSushi * currentMultiplier(state, config)
      state.score += points
      return { kind: 'sushi', points }
    }
  }
}

/**
 * Applies every object one swipe has just cut, in this order:
 *   1. soy sauce bottles, so a sushi cut in the same swipe already gets the bonus
 *   2. sushi, which score
 *   3. wasabi, which cost a life
 * The order does not depend on where the objects are in the list. Wasabi comes last on purpose:
 * if the swipe takes the last life, the sushi cut in that same swipe still counted, because
 * nothing is applied after the game is over. `outcome` is emptied and then filled with what
 * happened (for the popups and sounds); the caller keeps and reuses it.
 */
export function resolveCuts(
  state: ScoreState,
  cuts: readonly Sushi[],
  config: GameConfig,
  outcome: CutOutcome,
): void {
  outcome.awards.length = 0
  outcome.wasabiHits.length = 0

  for (const object of cuts) {
    if (object.type.kind === 'soySauce') applyCut(state, object, config)
  }
  for (const object of cuts) {
    if (object.type.kind !== 'sushi') continue
    const result = applyCut(state, object, config)
    if (result?.kind === 'sushi') outcome.awards.push({ sushi: object, points: result.points })
  }
  for (const object of cuts) {
    if (object.type.kind !== 'wasabi') continue
    if (applyCut(state, object, config)?.kind === 'wasabi') outcome.wasabiHits.push(object)
  }
}
