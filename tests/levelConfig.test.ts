import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEVEL_DURATION_SECONDS, getLevelConfig, levelConfigs } from '../src/game/levelConfig.ts'

// The level table is plain data. These tests pin down what Day 5, part 1 asked for, and catch a
// typo while tuning (a negative speed, a min above its max, a level that gets easier by accident).

test('there are exactly five levels, numbered 1 to 5 in play order', () => {
  assert.equal(levelConfigs.length, 5)
  assert.deepEqual(
    levelConfigs.map((config) => config.level),
    [1, 2, 3, 4, 5],
  )
})

test('the target scores are 100, 180, 260, 350 and 450', () => {
  assert.deepEqual(
    levelConfigs.map((config) => config.targetScore),
    [100, 180, 260, 350, 450],
  )
})

test('every level lasts 60 seconds', () => {
  assert.equal(LEVEL_DURATION_SECONDS, 60)
  for (const config of levelConfigs) assert.equal(config.durationSeconds, 60, `level ${config.level}`)
})

test('every number is finite and positive, and every { min, max } range has min <= max', () => {
  for (const config of levelConfigs) {
    const label = `level ${config.level}`
    const ranges = [config.spawnIntervalSeconds, config.horizontalSpeedWidths]
    const singles = [config.targetScore, config.durationSeconds, config.gravityPerHeight]
    for (const value of singles) assert.ok(Number.isFinite(value) && value > 0, `${label}: ${value}`)
    for (const { min, max } of ranges) {
      assert.ok(Number.isFinite(min) && Number.isFinite(max), `${label}: not a number`)
      assert.ok(min > 0, `${label}: min must be above 0`)
      assert.ok(min <= max, `${label}: min ${min} is above max ${max}`)
    }
  }
})

test('difficulty rises with every level: shorter waits between launches, faster objects', () => {
  for (let i = 1; i < levelConfigs.length; i += 1) {
    const before = levelConfigs[i - 1]
    const after = levelConfigs[i]
    const label = `level ${before.level} to ${after.level}`

    // Spawn rate: a shorter wait is a higher rate, so both ends of the range must go DOWN.
    assert.ok(after.spawnIntervalSeconds.min < before.spawnIntervalSeconds.min, `${label}: min wait`)
    assert.ok(after.spawnIntervalSeconds.max < before.spawnIntervalSeconds.max, `${label}: max wait`)

    // Object speed: gravity (up and down) and sideways speed both go UP.
    assert.ok(after.gravityPerHeight > before.gravityPerHeight, `${label}: gravity`)
    assert.ok(after.horizontalSpeedWidths.min > before.horizontalSpeedWidths.min, `${label}: min sideways speed`)
    assert.ok(after.horizontalSpeedWidths.max > before.horizontalSpeedWidths.max, `${label}: max sideways speed`)

    // The goal rises too.
    assert.ok(after.targetScore > before.targetScore, `${label}: target score`)
  }
})

test('getLevelConfig finds levels 1 to 5 and returns undefined for anything else', () => {
  for (const config of levelConfigs) assert.equal(getLevelConfig(config.level), config)
  for (const missing of [0, 6, -1, 1.5, Number.NaN]) assert.equal(getLevelConfig(missing), undefined, `${missing}`)
})
