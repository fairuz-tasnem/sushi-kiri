import { test } from 'node:test'
import assert from 'node:assert/strict'
import { levelConfigs } from '../src/game/levelConfig.ts'
import {
  LAST_LEVEL,
  createLevelClock,
  evaluateLevel,
  levelGameConfig,
  newRun,
  nextRunSetup,
  secondsLeftForDisplay,
  tickLevelClock,
} from '../src/game/levelProgress.ts'
import type { LevelResult } from '../src/game/levelProgress.ts'
import type { GameConfig } from '../src/game/gameConfig.ts'

const level1 = levelConfigs[0]
const level5 = levelConfigs[4]

function result(outcome: LevelResult['outcome'], level: number, livesLeft: number): LevelResult {
  return { outcome, level, score: 0, target: 0, livesLeft }
}

test('the clock starts at the level duration and counts down to exactly 0', () => {
  const clock = createLevelClock(level1)
  assert.equal(clock.remaining, 60)
  assert.equal(secondsLeftForDisplay(clock), 60)
  for (let i = 0; i < 1200; i += 1) tickLevelClock(clock, 0.05) // 60 s in 0.05 s frames
  assert.equal(clock.remaining, 0)
  tickLevelClock(clock, 1) // stays at 0
  assert.equal(clock.remaining, 0)
})

test('the clock ignores zero, negative and NaN steps', () => {
  const clock = createLevelClock(level1)
  for (const step of [0, -1, Number.NaN]) tickLevelClock(clock, step)
  assert.equal(clock.remaining, 60)
})

test('displayed seconds round up and only hit 0 when time is really up', () => {
  const clock = createLevelClock(level1)
  tickLevelClock(clock, 0.05)
  assert.equal(secondsLeftForDisplay(clock), 60)
  tickLevelClock(clock, 59.9)
  assert.equal(secondsLeftForDisplay(clock), 1)
  tickLevelClock(clock, 0.05)
  assert.equal(secondsLeftForDisplay(clock), 0)
})

test('evaluateLevel: still playing while below target with time and lives left', () => {
  assert.equal(evaluateLevel(level1, { score: 90, lives: 3 }, createLevelClock(level1)), null)
})

test('evaluateLevel: reaching the target completes levels 1-4 and wins level 5', () => {
  for (const config of levelConfigs.slice(0, 4)) {
    assert.equal(evaluateLevel(config, { score: config.targetScore, lives: 2 }, createLevelClock(config)), 'complete')
  }
  assert.equal(evaluateLevel(level5, { score: level5.targetScore, lives: 1 }, createLevelClock(level5)), 'victory')
})

test('evaluateLevel: time up below target fails the level', () => {
  const clock = createLevelClock(level1)
  tickLevelClock(clock, 60)
  assert.equal(evaluateLevel(level1, { score: 90, lives: 3 }, clock), 'failed')
})

test('evaluateLevel: target reached on the last moment still counts (target beats time)', () => {
  const clock = createLevelClock(level1)
  tickLevelClock(clock, 60)
  assert.equal(evaluateLevel(level1, { score: 100, lives: 3 }, clock), 'complete')
})

test('evaluateLevel: no lives beats everything, including a reached target and time up', () => {
  const clock = createLevelClock(level1)
  assert.equal(evaluateLevel(level1, { score: 0, lives: 0 }, clock), 'gameOver')
  assert.equal(evaluateLevel(level1, { score: 500, lives: 0 }, clock), 'gameOver')
  tickLevelClock(clock, 60)
  assert.equal(evaluateLevel(level1, { score: 0, lives: 0 }, clock), 'gameOver')
})

test('levelGameConfig uses the level tuning and the given lives, and leaves the base untouched', () => {
  const base = {
    spawnIntervalSeconds: { min: 9, max: 9 },
    gravityPerHeight: 9,
    horizontalSpeedWidths: { min: 9, max: 9 },
    startingLives: 3,
    pointsPerSushi: 10,
  } as unknown as GameConfig
  for (const config of levelConfigs) {
    const merged = levelGameConfig(base, config, 2)
    assert.deepEqual(merged.spawnIntervalSeconds, config.spawnIntervalSeconds)
    assert.equal(merged.gravityPerHeight, config.gravityPerHeight)
    assert.deepEqual(merged.horizontalSpeedWidths, config.horizontalSpeedWidths)
    assert.equal(merged.startingLives, 2)
    assert.equal(merged.pointsPerSushi, 10)
  }
  assert.equal(base.gravityPerHeight, 9)
  assert.equal(base.startingLives, 3)
})

test('a new run is level 1 with full lives', () => {
  assert.deepEqual(newRun(3), { level: 1, lives: 3 })
})

test('after a level is won the next level starts with the lives that were left', () => {
  assert.deepEqual(nextRunSetup(result('complete', 1, 2), 3), { level: 2, lives: 2 })
  assert.deepEqual(nextRunSetup(result('complete', 4, 1), 3), { level: 5, lives: 1 })
})

test('after a failed level the retry is the same level with full lives', () => {
  assert.deepEqual(nextRunSetup(result('failed', 3, 1), 3), { level: 3, lives: 3 })
})

test('after game over or victory the next run starts over', () => {
  assert.deepEqual(nextRunSetup(result('gameOver', 4, 0), 3), { level: 1, lives: 3 })
  assert.deepEqual(nextRunSetup(result('victory', LAST_LEVEL, 2), 3), { level: 1, lives: 3 })
})
