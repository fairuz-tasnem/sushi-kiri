import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GAME_SCREENS } from '../src/game/gameScreen.ts'
import type { GameScreen } from '../src/game/gameScreen.ts'
import { gestureHintText, resolveGestureCommand } from '../src/game/gestureCommands.ts'
import { GestureRecognizer } from '../src/vision/gestures.ts'
import type { GestureCommandType, HandLandmark } from '../src/vision/gestures.ts'
import { FIST, OPEN_PALM, POINTING, THUMBS_UP, V_SIGN } from './handFixtures.ts'

const GESTURES: GestureCommandType[] = ['thumbs-up', 'open-palm', 'v-sign']

// --------------------------------------------------------------------------------------
// The mapping table. Written out by hand on purpose (not derived from the code under test):
// every (gesture, screen) pair that is NOT listed here must do nothing.
// --------------------------------------------------------------------------------------

const EXPECTED: Record<string, GameScreen> = {
  'thumbs-up @ start': 'game',
  'thumbs-up @ pause': 'game',
  'open-palm @ game': 'pause',
  'v-sign @ game': 'start',
  'v-sign @ pause': 'start',
  'v-sign @ gameOver': 'start',
  'v-sign @ levelComplete': 'start',
  'v-sign @ levelFailed': 'start',
  'v-sign @ victory': 'start',
  'v-sign @ start': 'goodbye',
}

test('every gesture on every screen does exactly what the table says, and nothing else', () => {
  assert.ok(GAME_SCREENS.includes('goodbye'), 'the Goodbye screen exists')
  for (const gesture of GESTURES) {
    for (const screen of GAME_SCREENS) {
      const key = `${gesture} @ ${screen}`
      const action = resolveGestureCommand(gesture, screen)
      const expected = EXPECTED[key]
      if (expected === undefined) {
        assert.equal(action, null, `${key} must do nothing`)
      } else {
        assert.equal(action?.to, expected, key)
        assert.ok(GAME_SCREENS.includes(action.to))
      }
    }
  }
})

test('the menu-only and in-game-only rules in plain words', () => {
  // thumbs-up plays from the menu and resumes from pause, but not mid-game, on results, or elsewhere
  assert.equal(resolveGestureCommand('thumbs-up', 'game'), null)
  assert.equal(resolveGestureCommand('thumbs-up', 'gameOver'), null)
  assert.equal(resolveGestureCommand('thumbs-up', 'calibration'), null)
  // open palm only pauses a running game
  assert.equal(resolveGestureCommand('open-palm', 'pause'), null)
  assert.equal(resolveGestureCommand('open-palm', 'start'), null)
  // V-sign never works on setup screens
  for (const screen of ['instructions', 'settings', 'calibration', 'goodbye'] as const) {
    assert.equal(resolveGestureCommand('v-sign', screen), null, screen)
  }
})

test('hint text names the gesture and the result, or says it is not used', () => {
  assert.equal(gestureHintText('thumbs-up', resolveGestureCommand('thumbs-up', 'start')), 'Thumbs-up: starting the game')
  assert.equal(gestureHintText('thumbs-up', resolveGestureCommand('thumbs-up', 'pause')), 'Thumbs-up: resuming')
  assert.equal(gestureHintText('open-palm', resolveGestureCommand('open-palm', 'game')), 'Open palm: pausing')
  assert.equal(gestureHintText('v-sign', resolveGestureCommand('v-sign', 'game')), 'V-sign: back to the main menu')
  assert.equal(gestureHintText('v-sign', resolveGestureCommand('v-sign', 'start')), 'V-sign: opening Goodbye')
  assert.equal(gestureHintText('open-palm', null), 'Open palm recognized: not used on this screen')
})

// --------------------------------------------------------------------------------------
// Whole sessions: the REAL recognizer (hold times, cooldown, locks) feeding the mapping,
// with the same "apply the action to the current screen" step that useGestureCommands does.
// --------------------------------------------------------------------------------------

const STEP = 33

class Session {
  screen: GameScreen
  t = 0
  readonly recognizer = new GestureRecognizer()
  /** Every command the recognizer produced, and whether it changed the screen. */
  readonly log: Array<{ gesture: GestureCommandType; at: number; moved: boolean; screenAfter: GameScreen }> = []

  constructor(screen: GameScreen) {
    this.screen = screen
  }

  /** Shows `hand` (null = no hand) for `ms` milliseconds of ~30 fps frames. */
  show(hand: readonly HandLandmark[] | null, ms: number): this {
    const end = this.t + ms
    for (; this.t <= end; this.t += STEP) {
      const command = this.recognizer.update(hand ? { landmarks: hand } : null, this.t)
      if (!command) continue
      const action = resolveGestureCommand(command.gesture, this.screen)
      if (action) this.screen = action.to
      this.log.push({ gesture: command.gesture, at: this.t, moved: action !== null, screenAfter: this.screen })
    }
    return this
  }

  /** Relax the hand (a fist counts as a different pose) so the next hold can fire. */
  relax(ms = 200): this {
    return this.show(FIST(), ms)
  }

  /** Move to another screen the way a mouse click would (no gesture involved). */
  click(to: GameScreen): this {
    this.screen = to
    return this
  }
}

test('thumbs-up on the menu starts the game; keeping it held does nothing more', () => {
  const s = new Session('start').show(THUMBS_UP(), 800 + STEP)
  assert.equal(s.screen, 'game')
  s.show(THUMBS_UP(), 6000)
  assert.equal(s.screen, 'game')
  assert.equal(s.log.length, 1)
})

test('open palm pauses, thumbs-up resumes', () => {
  const s = new Session('game').show(OPEN_PALM(), 800 + STEP)
  assert.equal(s.screen, 'pause')
  s.relax(100).show(THUMBS_UP(), 2500)
  assert.equal(s.screen, 'game')
  assert.deepEqual(s.log.map((e) => e.gesture), ['open-palm', 'thumbs-up'])
})

test('V-sign needs the full second: 0.9 s does nothing, 1.0 s goes to the menu', () => {
  const short = new Session('game').show(V_SIGN(), 900)
  assert.equal(short.screen, 'game')
  assert.equal(short.log.length, 0)

  const full = new Session('game').show(V_SIGN(), 1000 + STEP)
  assert.equal(full.screen, 'start')
})

test('V-sign from a result screen and from pause goes to the menu', () => {
  assert.equal(new Session('gameOver').show(V_SIGN(), 1100).screen, 'start')
  assert.equal(new Session('pause').show(V_SIGN(), 1100).screen, 'start')
})

test('one V-sign hold = one action: it returns to the menu and does NOT also open Goodbye', () => {
  const s = new Session('game').show(V_SIGN(), 1100)
  assert.equal(s.screen, 'start')
  s.show(V_SIGN(), 10_000) // keep holding for ten more seconds
  assert.equal(s.screen, 'start')
  assert.equal(s.log.length, 1)
})

test('Goodbye needs a separate, repeated V-sign: change pose first, then hold it again', () => {
  const s = new Session('game').show(V_SIGN(), 1100)
  assert.equal(s.screen, 'start')

  // losing and regaining tracking while still showing the V-sign is not "changing pose"
  s.show(null, 200).show(V_SIGN(), 4000)
  assert.equal(s.screen, 'start', 'same V-sign must not repeat without a pose change')

  // a different pose, then a second, deliberate V-sign hold
  s.relax(200).show(V_SIGN(), 3000)
  assert.equal(s.screen, 'goodbye')
  assert.equal(s.log.length, 2)
})

test('after the cooldown rule: a repeated V-sign right after the first still needs its full second', () => {
  const s = new Session('game').show(V_SIGN(), 1100)
  const firedAt = s.log[0].at
  s.relax(100).show(V_SIGN(), 3000)
  const second = s.log[1]
  assert.ok(second, 'the repeated V-sign eventually works')
  // cooldown is 1.5 s and the hold is 1.0 s counted from the end of the cooldown
  assert.ok(second.at - firedAt >= 1500 + 1000, `second action only ${second.at - firedAt} ms after the first`)
})

test('Goodbye is a dead end for gestures; a button click brings the menu back', () => {
  const s = new Session('start').show(V_SIGN(), 1100)
  assert.equal(s.screen, 'goodbye')
  s.relax(200).show(V_SIGN(), 3000).relax(200).show(THUMBS_UP(), 3000).relax(200).show(OPEN_PALM(), 3000)
  assert.equal(s.screen, 'goodbye')
  s.click('start')
  assert.equal(s.screen, 'start')
})

test('invalid-state commands are recognized but do not move the screen', () => {
  const s = new Session('instructions').show(THUMBS_UP(), 1100)
  assert.equal(s.screen, 'instructions')
  assert.equal(s.log.length, 1)
  assert.equal(s.log[0].moved, false)
})

test('normal slicing (pointing) and a closed hand never change the screen, however long', () => {
  for (const screen of ['start', 'game', 'pause', 'gameOver'] as const) {
    const s = new Session(screen).show(POINTING(), 10_000).show(FIST(), 5000)
    assert.equal(s.screen, screen)
    assert.equal(s.log.length, 0)
  }
})

test('losing tracking mid-hold cancels the gesture; mouse/keyboard navigation is unaffected', () => {
  const s = new Session('start').show(THUMBS_UP(), 700).show(null, 1000)
  assert.equal(s.screen, 'start')
  assert.equal(s.log.length, 0)
  // no hand at all for a long time: gestures do nothing, clicks still work
  s.show(null, 30_000)
  s.click('instructions')
  assert.equal(s.screen, 'instructions')
})

test('a full play-through by gestures only', () => {
  const s = new Session('start')
  s.show(THUMBS_UP(), 900) // menu -> game
  s.relax(100).show(OPEN_PALM(), 2500) // game -> pause
  s.relax(100).show(THUMBS_UP(), 2500) // pause -> game
  s.relax(100).show(V_SIGN(), 3000) // game -> menu
  s.relax(100).show(V_SIGN(), 3000) // menu -> goodbye
  assert.deepEqual(s.log.map((e) => e.screenAfter), ['game', 'pause', 'game', 'start', 'goodbye'])
})
