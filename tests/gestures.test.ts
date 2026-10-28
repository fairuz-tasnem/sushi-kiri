import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyHandPose,
  COOLDOWN_MS,
  GestureRecognizer,
  HOLD_MS,
  MAX_FRAME_GAP_MS,
} from '../src/vision/gestures.ts'
import type { GestureCommand, HandLandmark } from '../src/vision/gestures.ts'
import {
  FIST,
  inWideFrame,
  makeHand,
  mirroredHorizontally,
  OPEN_PALM,
  POINTING,
  rotated,
  shifted,
  THUMBS_UP,
  V_SIGN,
} from './handFixtures.ts'

const STEP = 33 // about 30 frames per second

type Frame = readonly HandLandmark[] | null

/** Feeds `hand` (or null = no hand) every STEP ms from `from` up to and including `from + duration`. */
function feed(rec: GestureRecognizer, hand: Frame, from: number, duration: number): { commands: GestureCommand[]; end: number } {
  const commands: GestureCommand[] = []
  let t = from
  for (; t <= from + duration; t += STEP) {
    const c = rec.update(hand ? { landmarks: hand } : null, t)
    if (c) commands.push(c)
  }
  return { commands, end: t }
}

// --------------------------------------------------------------------------------------
// Layer 1: classifying one frame
// --------------------------------------------------------------------------------------

test('classifies the three command poses', () => {
  assert.equal(classifyHandPose(THUMBS_UP()), 'thumbs-up')
  assert.equal(classifyHandPose(OPEN_PALM()), 'open-palm')
  assert.equal(classifyHandPose(V_SIGN()), 'v-sign')
})

test('index-finger pointing (the slicing pose) and a fist are not commands', () => {
  assert.equal(classifyHandPose(POINTING()), 'none')
  assert.equal(classifyHandPose(FIST()), 'none')
  // pointing with the thumb out is still pointing
  const pointingThumbOut = makeHand({ thumb: 'out', index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' })
  assert.equal(classifyHandPose(pointingThumbOut), 'none')
})

test('near-misses are rejected', () => {
  // thumb pointing down, fist
  assert.equal(classifyHandPose(makeHand({ thumb: 'down', index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' })), 'none')
  // thumbs-up shape turned sideways: the thumb no longer points up the image
  assert.equal(classifyHandPose(rotated(THUMBS_UP(), 90)), 'none')
  // open hand with the thumb tucked in
  assert.equal(classifyHandPose(makeHand({ thumb: 'tucked', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' })), 'none')
  // three fingers
  assert.equal(classifyHandPose(makeHand({ thumb: 'tucked', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'curled' })), 'none')
  // two fingers held together, not a V
  assert.equal(classifyHandPose(makeHand({ thumb: 'tucked', index: 'extended', middle: 'extended', ring: 'curled', pinky: 'curled', together: true })), 'none')
  // V-sign with a half-bent ring finger: unsure fingers never count
  assert.equal(classifyHandPose(makeHand({ thumb: 'tucked', index: 'extended', middle: 'extended', ring: 'half', pinky: 'curled' })), 'none')
  // open palm with a half-bent pinky
  assert.equal(classifyHandPose(makeHand({ thumb: 'out', index: 'extended', middle: 'extended', ring: 'extended', pinky: 'half' })), 'none')
  // thumbs-up with a half-bent index finger
  assert.equal(classifyHandPose(makeHand({ thumb: 'up', index: 'half', middle: 'curled', ring: 'curled', pinky: 'curled' })), 'none')
})

test('bad input gives none', () => {
  assert.equal(classifyHandPose(null), 'none')
  assert.equal(classifyHandPose([]), 'none')
  assert.equal(classifyHandPose(OPEN_PALM().slice(0, 20)), 'none')
  const withNaN = OPEN_PALM()
  withNaN[8] = { x: Number.NaN, y: 0.5 }
  assert.equal(classifyHandPose(withNaN), 'none')
  // a hand collapsed to (almost) a point is too small to judge
  const tiny = OPEN_PALM().map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.05, y: 0.5 + (p.y - 0.85) * 0.05 }))
  assert.equal(classifyHandPose(tiny), 'none')
})

test('result does not depend on position, size, mirroring, rotation (V/open palm) or frame shape', () => {
  assert.equal(classifyHandPose(shifted(THUMBS_UP(), 0.1, -0.2)), 'thumbs-up')
  assert.equal(classifyHandPose(mirroredHorizontally(THUMBS_UP())), 'thumbs-up')
  assert.equal(classifyHandPose(mirroredHorizontally(OPEN_PALM())), 'open-palm')
  assert.equal(classifyHandPose(rotated(V_SIGN(), 70)), 'v-sign')
  assert.equal(classifyHandPose(rotated(OPEN_PALM(), -110)), 'open-palm')
  const small = THUMBS_UP().map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.4, y: 0.5 + (p.y - 0.85) * 0.4 }))
  assert.equal(classifyHandPose(small), 'thumbs-up')
  // 16:9 frame: x is squeezed by the aspect ratio unless the aspect is passed in
  const aspect = 16 / 9
  assert.equal(classifyHandPose(inWideFrame(THUMBS_UP(), aspect), aspect), 'thumbs-up')
  assert.equal(classifyHandPose(inWideFrame(OPEN_PALM(), aspect), aspect), 'open-palm')
  assert.equal(classifyHandPose(inWideFrame(V_SIGN(), aspect), aspect), 'v-sign')
  assert.equal(classifyHandPose(inWideFrame(POINTING(), aspect), aspect), 'none')
})

// --------------------------------------------------------------------------------------
// Layer 2: holds, resets, cooldown
// --------------------------------------------------------------------------------------

test('required hold times and cooldown', () => {
  assert.equal(COOLDOWN_MS, 1500)
  assert.equal(HOLD_MS['thumbs-up'], 800)
  assert.equal(HOLD_MS['open-palm'], 800)
  assert.equal(HOLD_MS['v-sign'], 1000)
})

test('each pose fires once, only after its full hold time', () => {
  const cases: Array<[() => HandLandmark[], 'thumbs-up' | 'open-palm' | 'v-sign', number]> = [
    [THUMBS_UP, 'thumbs-up', 800],
    [OPEN_PALM, 'open-palm', 800],
    [V_SIGN, 'v-sign', 1000],
  ]
  for (const [make, gesture, required] of cases) {
    // just short of the time: nothing
    const early = new GestureRecognizer()
    assert.equal(feed(early, make(), 0, required - 1).commands.length, 0, `${gesture} fired early`)

    // frames every 20 ms: silent up to required - 20, fires on the frame at exactly `required`
    const exact = new GestureRecognizer()
    for (let t = 0; t < required; t += 20) {
      assert.equal(exact.update({ landmarks: make() }, t), null, `${gesture} fired at ${t}`)
    }
    const command = exact.update({ landmarks: make() }, required)
    assert.deepEqual(command, { gesture, timestamp: required, heldMs: required })

    // held for a long time: still exactly one command (one trigger per hold)
    const long = new GestureRecognizer()
    const { commands } = feed(long, make(), 0, 10_000)
    assert.equal(commands.length, 1, `${gesture} fired more than once in one hold`)
    assert.equal(commands[0].gesture, gesture)
  }
})

test('pointing or slicing never produces a command', () => {
  const rec = new GestureRecognizer()
  assert.equal(feed(rec, POINTING(), 0, 10_000).commands.length, 0)

  // a slicing sweep: pointing hand moving quickly across the frame
  const sweep = new GestureRecognizer()
  let t = 0
  for (let i = 0; i < 60; i += 1, t += STEP) {
    assert.equal(sweep.update({ landmarks: shifted(POINTING(), -0.3 + i * 0.01) }, t), null)
  }
})

test('a moving open hand (a sweep) does not count as a held pose; a still one does', () => {
  const rec = new GestureRecognizer()
  let t = 0
  const commands: GestureCommand[] = []
  // moves 0.012 per frame: about 0.36 per second (1.8 palms/s) for 2 seconds
  for (let i = 0; i < 60; i += 1, t += STEP) {
    const c = rec.update({ landmarks: shifted(OPEN_PALM(), -0.2 + i * 0.012) }, t)
    if (c) commands.push(c)
  }
  assert.equal(commands.length, 0)

  // small tremor around one spot still counts as stable
  const steady = new GestureRecognizer()
  t = 0
  for (let i = 0; i < 40; i += 1, t += STEP) {
    const c = steady.update({ landmarks: shifted(OPEN_PALM(), (i % 2) * 0.005, (i % 3) * 0.004) }, t)
    if (c) commands.push(c)
  }
  assert.equal(commands.length, 1)
})

test('the hold timer resets when the pose changes', () => {
  const rec = new GestureRecognizer()
  // 700 ms of thumbs-up, then open palm for 700 ms, then thumbs-up for 700 ms: never 800 in a row
  let t = 0
  t = feed(rec, THUMBS_UP(), t, 700).end
  t = feed(rec, OPEN_PALM(), t, 700).end
  const last = feed(rec, THUMBS_UP(), t, 700)
  assert.equal(last.commands.length, 0)
  // a frame of 'none' (fist) in the middle also resets
  const rec2 = new GestureRecognizer()
  t = feed(rec2, THUMBS_UP(), 0, 600).end
  t = feed(rec2, FIST(), t, 0).end
  assert.equal(feed(rec2, THUMBS_UP(), t, 600).commands.length, 0)
})

test('the hold timer resets when tracking is lost', () => {
  const rec = new GestureRecognizer()
  let t = feed(rec, V_SIGN(), 0, 800).end // 0.8 s of the 1.0 s needed
  t = feed(rec, null, t, 66).end // hand lost for two frames
  const after = feed(rec, V_SIGN(), t, 800)
  assert.equal(after.commands.length, 0, 'the earlier 0.8 s must not carry over')
  // ...but a complete new hold afterwards does fire
  assert.equal(feed(rec, V_SIGN(), after.end, 400).commands.length, 1)
})

test('the hold timer resets after a gap in the frames', () => {
  const rec = new GestureRecognizer()
  // 600 ms of open palm in 20 ms frames, then the frames stop for more than MAX_FRAME_GAP_MS
  for (let t = 0; t <= 600; t += 20) rec.update({ landmarks: OPEN_PALM() }, t)
  const resume = 600 + MAX_FRAME_GAP_MS + 1
  // the 600 ms before the gap must not count: the new hold starts at `resume`
  for (let t = resume; t < resume + 800; t += 20) {
    assert.equal(rec.update({ landmarks: OPEN_PALM() }, t), null, `fired at ${t}, using time from before the gap`)
  }
  assert.equal(rec.update({ landmarks: OPEN_PALM() }, resume + 800)?.gesture, 'open-palm')
})

test('the same gesture cannot fire again until the pose changes', () => {
  const rec = new GestureRecognizer()
  const first = feed(rec, THUMBS_UP(), 0, 1000)
  assert.equal(first.commands.length, 1)

  // keep holding for far longer than the cooldown: nothing
  let t = feed(rec, THUMBS_UP(), first.end, COOLDOWN_MS + 3000).end
  // losing and regaining tracking is not a pose change
  t = feed(rec, null, t, 200).end
  const regained = feed(rec, THUMBS_UP(), t, 3000)
  assert.equal(regained.commands.length, 0)
  t = regained.end

  // a different pose (here a fist = 'none') unlocks it, and a full new hold fires again
  t = feed(rec, FIST(), t, 100).end
  const again = feed(rec, THUMBS_UP(), t, 1000)
  assert.equal(again.commands.length, 1)
  assert.equal(again.commands[0].gesture, 'thumbs-up')
})

test('cooldown: after a command nothing fires for COOLDOWN_MS, and a new hold still needs its full time', () => {
  const rec = new GestureRecognizer()
  const fired = feed(rec, THUMBS_UP(), 0, 900)
  assert.equal(fired.commands.length, 1)
  const firedAt = fired.commands[0].timestamp

  // switch straight to an open palm and hold it. It may not fire inside the cooldown, and
  // its 800 ms must be counted from the end of the cooldown, not from the pose change.
  const palm = feed(rec, OPEN_PALM(), firedAt + STEP, 1500 + 2000)
  assert.equal(palm.commands.length, 1)
  const cooldownEnd = firedAt + 1500 // literal on purpose: do not derive it from the code under test
  assert.ok(palm.commands[0].timestamp >= cooldownEnd + HOLD_MS['open-palm'], `fired at ${palm.commands[0].timestamp}, too early`)
  assert.ok(palm.commands[0].heldMs >= HOLD_MS['open-palm'])
})

test('a different gesture can fire right after the first one is released, once cooldown and hold time have passed', () => {
  const rec = new GestureRecognizer()
  let t = feed(rec, V_SIGN(), 0, 1100).end // fires
  t = feed(rec, FIST(), t, 2000).end // relax past the cooldown
  const next = feed(rec, THUMBS_UP(), t, 900)
  assert.equal(next.commands.length, 1)
  assert.equal(next.commands[0].gesture, 'thumbs-up')
})

test('reset() drops a hold in progress but keeps the lock after a command', () => {
  const rec = new GestureRecognizer()
  let t = feed(rec, OPEN_PALM(), 0, 700).end
  rec.reset()
  assert.equal(feed(rec, OPEN_PALM(), t, 700).commands.length, 0)

  const rec2 = new GestureRecognizer()
  t = feed(rec2, OPEN_PALM(), 0, 900).end // fires
  rec2.reset()
  assert.equal(feed(rec2, OPEN_PALM(), t + COOLDOWN_MS + 100, 2000).commands.length, 0)
})

test('invalid frames are treated as lost tracking', () => {
  const rec = new GestureRecognizer()
  let t = feed(rec, OPEN_PALM(), 0, 700).end
  assert.equal(rec.update({ landmarks: [] }, t), null)
  t += STEP
  assert.equal(feed(rec, OPEN_PALM(), t, 700).commands.length, 0)
  assert.equal(rec.update(null, Number.NaN), null)
})
