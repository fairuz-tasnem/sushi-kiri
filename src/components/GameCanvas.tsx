import { useEffect, useRef } from 'react'
import { createCanvasView, hasArea, syncCanvasSize } from '../game/canvasView'
import { gameConfig } from '../game/gameConfig'
import { createGameLoop } from '../game/gameLoop'
import { preloadSprites, readPlaceholderColors, renderFrame } from '../game/renderer'
import type { FrameHud } from '../game/renderer'
import { DESCENT_SECONDS, descendObjects } from '../game/descent'
import { playSound, stopSound, setMusicScreen } from '../game/audio'
import { createCutOutcome, createScoreState, resolveCuts, updateScoreState } from '../game/scoring'
import {
  createLevelClock,
  evaluateLevel,
  levelGameConfig,
  secondsLeftForDisplay,
  tickLevelClock,
} from '../game/levelProgress'
import type { LevelOutcome, LevelResult } from '../game/levelProgress'
import type { LevelConfig } from '../game/levelConfig'
import {
  addPenaltyPopup,
  addScorePopup,
  advanceFingertip,
  ageFingertipTrail,
  ageScorePopups,
  createFingertip,
  resetFingertip,
  trySliceSushi,
  segmentIntersectsRect,
} from '../game/slicing'
import type { Point, ScorePopup } from '../game/slicing'
import type { Sushi } from '../game/sushi'
import { createSushiSpawner, updateSushiSpawner } from '../game/sushiSpawner'
import { isInsideRect, mapVideoPointToScreen } from '../vision/coordinateMapper'
import type { NormalizedPoint } from '../vision/coordinateMapper'
import { useHandTracking } from '../vision/HandTrackingContext'

/** Owns one level's simulation, scoring and rendering. Pause preserves this mount;
 * retry/next level remount it. Camera and tracking remain owned by App. */
interface GameCanvasProps {
  /**
   * True while the game is paused: the loop stops (nothing spawns, moves, ages or scores, the soy
   * sauce clock stands still) and fingertip readings are ignored, but every piece of game state
   * is kept, and the last frame stays on screen. False resumes exactly where it stopped.
   */
  onEnding: () => void
  paused?: boolean
  /** Called with the new total each time a sushi is cut, and with 0 when the canvas starts. */
  onScoreChange?: (score: number) => void
  /** The level to play. Read once when the screen opens; a different level means a new mount. */
  level: LevelConfig
  /** Lives this level starts with (3 on a new run or a retry, the lives left after a level won). */
  startingLives: number
  /**
   * Called exactly once, when the level ends in any way (target reached, time up, no lives left).
   * The loop and the fingertip listener have stopped by then.
   */
  onLevelEnd: (result: LevelResult) => void
  /** Called with the whole seconds left on the level clock: at the start, then each time it changes. */
  onSecondsLeftChange?: (secondsLeft: number) => void
}

/** How long the "lost a life" edge frame takes to fade out, in seconds. */
const PENALTY_FADE_SECONDS = 0.5

export default function GameCanvas({
  onEnding,
  paused = false,
  onScoreChange,
  level,
  startingLives,
  onLevelEnd,
  onSecondsLeftChange,
}: GameCanvasProps) {
  const { subscribe, video, inputMode } = useHandTracking()
  const onEndingRef = useRef(onEnding)
  onEndingRef.current = onEnding
  const inputModeRef = useRef(inputMode)
  inputModeRef.current = inputMode
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // The effect below must run exactly once per mount (it owns the loop), so anything that can
  // change between renders is read through a ref instead of being a dependency of that effect.
  const videoRef = useRef(video)
  const onScoreChangeRef = useRef(onScoreChange)
  const pausedRef = useRef(paused)
  /** Set by the main effect below; the small effect after it calls this when `paused` changes. */
  const applyPausedRef = useRef<(paused: boolean) => void>(() => {})
  const onLevelEndRef = useRef(onLevelEnd)
  const onSecondsLeftRef = useRef(onSecondsLeftChange)
  // The level and lives are fixed for the life of this mount (see the Levels paragraph above).
  const levelRef = useRef(level)
  const startingLivesRef = useRef(startingLives)
  useEffect(() => {
    videoRef.current = video
  }, [video])
  useEffect(() => {
    onLevelEndRef.current = onLevelEnd
  }, [onLevelEnd])
  useEffect(() => {
    onSecondsLeftRef.current = onSecondsLeftChange
  }, [onSecondsLeftChange])
  useEffect(() => {
    onScoreChangeRef.current = onScoreChange
  }, [onScoreChange])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      console.error('Game canvas: this browser did not give a 2D drawing context.')
      return
    }

    const view = createCanvasView()
    preloadSprites()
    const colors = readPlaceholderColors()
    const levelConfig = levelRef.current
    // gameConfig with THIS level's spawn waits and object speeds on top, and the carried-over
    // lives as the starting lives. Everything that spawns or scores below reads this one object.
    const config = levelGameConfig(gameConfig, levelConfig, startingLivesRef.current)
    const spawner = createSushiSpawner(config)
    // Score, lives and the soy sauce bonus clock (src/game/scoring.ts). Fresh on every mount, so
    // each level starts at score 0 with no bonus running, and with the lives it was given.
    const scoreState = createScoreState(config)
    // The level's own 60-second clock, counted down from update() below.
    const levelClock = createLevelClock(levelConfig)
    let shownSeconds = -1 // the last whole-seconds value reported, so it is reported only on change
    const cuts: Sushi[] = [] // reused: what one swipe has cut
    const outcome = createCutOutcome() // reused: what those cuts scored or cost
    let descentAge: number | null = null
    let lostFrom = startingLivesRef.current
    let ended = false // true from the moment the level ends (any way); nothing runs after that
    let isPaused = false // true while the Pause screen is open; the state below is kept as it is
    let secondsSincePenalty = Infinity // time since the last wasabi hit, for the fading edge frame
    // What the HUD reads. The same object every frame; render() refreshes it.
    const hud: FrameHud = {
      lives: scoreState.lives,
      maxLives: gameConfig.startingLives, // the row always shows the full 3 hearts
      penalty: 0,
      soyRemaining: 0,
      soyDuration: config.soySauceDurationSeconds,
      multiplier: config.soySauceMultiplier,
      lostFrom,
      lossProgress: 1,
    }
    const fingertip = createFingertip()
    const popups: ScorePopup[] = []
    // The same two arrays every frame; slicing.ts only ever empties them in place.
    const effects = { trail: fingertip.trail, popups }

    const update = (deltaSeconds: number, elapsedSeconds: number) => {
      if (ended) return // game over: no spawning, no movement, no timers
      if (!hasArea(view)) return // hidden or zero-sized: nothing to move across yet
      secondsSincePenalty += elapsedSeconds
      if (descentAge !== null) {
        descentAge += elapsedSeconds
        descendObjects(spawner.sushi, deltaSeconds, descentAge / DESCENT_SECONDS)
        ageScorePopups(popups, deltaSeconds)
        if (descentAge >= DESCENT_SECONDS) finishLevel('gameOver')
        return
      }
      updateSushiSpawner(spawner, deltaSeconds, view, config)
      updateScoreState(scoreState, elapsedSeconds) // the soy sauce bonus counts down in the same loop
      ageFingertipTrail(fingertip, deltaSeconds)
      ageScorePopups(popups, deltaSeconds)
      tickLevelClock(levelClock, elapsedSeconds) // so does the level clock
      reportSeconds()
      checkLevelEnd() // time up (or anything else that ended the level this frame)
    }

    const render = () => {
      hud.lostFrom = lostFrom
      hud.lossProgress = Math.min(1, secondsSincePenalty / .5)
      hud.lives = scoreState.lives
      hud.penalty = Math.max(0, 1 - secondsSincePenalty / PENALTY_FADE_SECONDS)
      hud.soyRemaining = scoreState.soyRemaining
      renderFrame(ctx, view, spawner.sushi, colors, effects, hud, isPaused)
    }

    // Resizing a canvas erases it. ResizeObserver callbacks run after the browser's
    // animation-frame callbacks but before it paints, so draw again right here;
    // otherwise one blank frame would flash while the window is being dragged.
    // A resize also moves everything on screen, so a swipe in progress is abandoned.
    const resize = () => {
      syncCanvasSize(canvas, view)
      resetFingertip(fingertip)
      render()
    }

    // One fingertip reading at a time (up to 60 a second), straight from the hand tracker.
    // A cut is tested right here, against every sushi exactly as the player last saw them.
    const processPoint = (position: Point, timestamp: number) => {
      if (ended || isPaused || descentAge !== null) return
      const swipe = advanceFingertip(fingertip, position, timestamp, view)
      if (!swipe) return // first reading of a sequence: nothing to cut with yet

      // Reject the whole swipe when it crosses a control, even with both endpoints outside.
      const blocked = Array.from(document.querySelectorAll('[data-game-ui], .voice-status')).some(element =>
        segmentIntersectsRect(swipe, element.getBoundingClientRect()))
      if (blocked) { resetFingertip(fingertip); return }

      // One swipe can cut several objects. Each one can only be cut once (trySliceSushi).
      cuts.length = 0
      for (const object of spawner.sushi) {
        if (trySliceSushi(object, swipe, fingertip)) cuts.push(object)
      }
      if (cuts.length === 0) return
      if (cuts.some(object => object.type.kind === 'soySauce')) playSound('soy-bonus')
      if (cuts.some(object => object.type.kind === 'sushi')) playSound('sushi-cut')

      // Turn the cuts into points, the soy sauce bonus or lost lives (src/game/scoring.ts), then
      // show the matching feedback.
      const previousLives = scoreState.lives
      resolveCuts(scoreState, cuts, config, outcome)
      for (const award of outcome.awards) addScorePopup(popups, award.sushi, view, award.points)
      if (outcome.awards.length > 0) onScoreChangeRef.current?.(scoreState.score)

      if (outcome.wasabiHits.length > 0) {
        lostFrom = previousLives
        for (const wasabi of outcome.wasabiHits) addPenaltyPopup(popups, wasabi, view, '-1 life')
        secondsSincePenalty = 0 // restarts the edge frame
        playSound('wasabi-hit') // silent if the manifest has no file for it
      }

      checkLevelEnd() // this swipe may have reached the target or taken the last life
    }
    const unsubscribe = subscribe(sample => {
      if (inputModeRef.current !== 'hand') return
      if (!sample) { resetFingertip(fingertip); return }
      if (sample.previous === null) resetFingertip(fingertip)
      const position = toCanvasPosition(sample.point, videoRef.current, canvas)
      if (!position) { resetFingertip(fingertip); return }
      processPoint(position, sample.timestamp)
    })
    const mouse = (event: PointerEvent) => {
      if (inputModeRef.current !== 'mouse' || event.pointerType === 'touch') return
      if (!(event.buttons & 1)) { resetFingertip(fingertip); return }
      processPoint({ x: event.clientX, y: event.clientY }, performance.now())
    }
    const releaseMouse = () => resetFingertip(fingertip)
    window.addEventListener('pointermove', mouse)
    window.addEventListener('pointerup', releaseMouse)


    const loop = createGameLoop({ update, render })

    // Tells the screen the whole seconds left, only when that number changes (about once a second).
    function reportSeconds() {
      const seconds = secondsLeftForDisplay(levelClock)
      if (seconds === shownSeconds) return
      shownSeconds = seconds
      onSecondsLeftRef.current?.(seconds)
    }

    // Asks levelProgress.ts whether the level is over. Called after every score change and every
    // frame; does nothing while the level is still being played.
    function checkLevelEnd() {
      if (ended) return
      const outcome = evaluateLevel(levelConfig, scoreState, levelClock)
      if (outcome === 'gameOver' && descentAge === null) {
        descentAge = 0
        resetFingertip(fingertip)
        onEndingRef.current()
        setMusicScreen('descent')
        playSound('game-over')
      } else if (outcome && descentAge === null) finishLevel(outcome)
    }

    // The level is over. In this order: mark it ended (so update() and the fingertip listener do
    // nothing from now on, and a second call does nothing), draw one final frame so the screen
    // shows the last hit, stop the loop and the listener, and only then tell the screen. This is
    // the ONLY place a level ends, which is what makes every transition happen at most once.
    function finishLevel(outcome: LevelOutcome) {
      if (ended) return
      ended = true
      render()
      loop.stop()
      unsubscribe()
      onLevelEndRef.current({
        outcome,
        level: levelConfig.level,
        score: scoreState.score,
        target: levelConfig.targetScore,
        livesLeft: scoreState.lives,
      })
    }
    // Pause stops the ONE loop and forgets the swipe in progress; resume starts that same loop
    // again (its first frame moves nothing, so there is no jump). Nothing else is touched, so the
    // sushi, score, lives and bonus come back exactly as they were. After game over it does nothing.
    applyPausedRef.current = (nextPaused: boolean) => {
      if (ended || nextPaused === isPaused) return
      isPaused = nextPaused
      if (nextPaused) {
        loop.stop()
        resetFingertip(fingertip)
        render() // Clear frozen swipe pixels immediately; resize uses the same paused render.
      } else {
        loop.start()
      }
    }

    onScoreChangeRef.current?.(scoreState.score)
    reportSeconds()
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    loop.start()
    if (pausedRef.current) applyPausedRef.current(true)

    // Stop listening first, so no reading can arrive after the loop has stopped.
    return () => {
      stopSound('game-over')
      window.removeEventListener('pointermove', mouse)
      window.removeEventListener('pointerup', releaseMouse)
      applyPausedRef.current = () => {}
      unsubscribe()
      loop.stop()
      observer.disconnect()
      resetFingertip(fingertip)
    }
  }, [subscribe])

  // Pause / resume. Declared AFTER the main effect so that, on mount, the main effect has already
  // registered applyPausedRef.
  useEffect(() => {
    pausedRef.current = paused
    applyPausedRef.current(paused)
  }, [paused])

  return <canvas ref={canvasRef} className="game-canvas" aria-hidden="true" />
}

/**
 * Where on the canvas the player's fingertip is, in CSS pixels, or null if it is not on the
 * visible play area.
 *
 * This is the same mapping the fingertip cursor uses (HandCursor.tsx), so a slice happens exactly
 * where the cursor is drawn. mapVideoPointToScreen applies the two things the page does to the
 * camera picture: object-fit: cover (scale and centre-crop) and the mirror flip. The result is
 * a window position, which is then shifted by the canvas's own position so it is relative to
 * the canvas's top-left corner like everything else the game draws.
 *
 * null means: the video is not showing yet, the fingertip is in a part of the picture that
 * cover-cropping cut off, or it is outside the canvas. The cursor is hidden in the first two
 * cases too.
 */
function toCanvasPosition(
  point: NormalizedPoint,
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement,
): Point | null {
  if (!video) return null

  const videoRect = video.getBoundingClientRect()
  const onScreen = mapVideoPointToScreen(
    point,
    { width: video.videoWidth, height: video.videoHeight },
    videoRect,
  )
  if (!onScreen || !isInsideRect(onScreen, videoRect)) return null

  const canvasRect = canvas.getBoundingClientRect()
  if (!isInsideRect(onScreen, canvasRect)) return null

  return { x: onScreen.x - canvasRect.left, y: onScreen.y - canvasRect.top }
}
