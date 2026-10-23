import { useEffect, useRef } from 'react'
import { createCanvasView, hasArea, syncCanvasSize } from '../game/canvasView'
import { gameConfig } from '../game/gameConfig'
import { createGameLoop } from '../game/gameLoop'
import { readPlaceholderColors, renderFrame } from '../game/renderer'
import type { FrameHud } from '../game/renderer'
import { playSound } from '../game/audio'
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
} from '../game/slicing'
import type { Point, ScorePopup } from '../game/slicing'
import type { Sushi } from '../game/sushi'
import { createSushiSpawner, updateSushiSpawner } from '../game/sushiSpawner'
import { isInsideRect, mapVideoPointToScreen } from '../vision/coordinateMapper'
import type { NormalizedPoint } from '../vision/coordinateMapper'
import { useHandTracking } from '../vision/HandTrackingContext'

/**
 * The gameplay Canvas. It fills the whole window (see .game-canvas) and is transparent,
 * so the live camera video behind it stays visible.
 *
 * This component is the ONLY owner of the game loop, and it exists only while the
 * Playing screen is open (CurrentScreen renders it for 'game' and for nothing else).
 * So the loop starts when the screen opens and stops when it closes. The effect below
 * is the whole lifecycle:
 *
 *   mount    -> size the canvas, start watching for resizes, start the loop
 *   unmount  -> stop the loop, stop watching
 *
 * In development React runs mount -> unmount -> mount once on purpose (StrictMode).
 * That is safe here: the cleanup stops the first loop completely before the second starts.
 *
 * Game state (the spawner and its sushi, the fingertip trail, the score popups) lives in plain
 * variables, not React state, because it changes every frame and React should not re-render
 * 60 times a second for it. The one exception is the score, which changes only when a sushi is cut:
 * the canvas owns it and reports every change through `onScoreChange` so the screen can show it.
 *
 * Spawning (Task 2): one spawner (src/game/sushiSpawner.ts) is created each time this component
 * mounts and is updated from the loop's update(). It launches several sushi over time and
 * removes the ones that have finished. Because the loop only runs while this component exists,
 * nothing spawns or moves on Pause, Game Over or any other screen.
 *
 * Scoring (Task 3): src/game/scoring.ts keeps the score and the soy sauce bonus clock. This
 * component feeds it the objects each swipe cuts and the frame time from update(), and the
 * renderer draws the bonus badge (top right) from it. No second loop or timer exists.
 *
 * Lives and Game Over (Task 4): the same ScoreState holds the lives. Cutting a wasabi takes one
 * (scoring.ts), which shows a "-1 life" popup, an edge frame that fades out, and plays the
 * "wasabi-hit" sound if the manifest has one. When the last life goes, endGame() below draws one
 * final frame, stops the loop and the fingertip listener at once (so nothing spawns, moves or
 * scores any more), and tells the screen through `onGameOver` to open the Game Over screen.
 * A new visit to this screen is a new mount, so lives, score, bonus, objects and popups all
 * start fresh.
 *
 * Levels (Day 5, part 2): this component plays ONE level per mount. The level (its 60-second clock,
 * spawn waits and object speeds, from levelConfig.ts) and the lives it starts with (carried over
 * from the level before) come in as props and are read once, when the screen opens. The level
 * clock (src/game/levelProgress.ts) is counted down in update(), in the same loop as everything
 * else, so it stops on pause and on unmount with no timer of its own. After every score change and
 * every frame, evaluateLevel() says whether the level has ended (target reached, time up or no
 * lives left); the first answer wins, finishLevel() runs once (the `ended` guard), stops the loop
 * and the fingertip listener, and reports a LevelResult through `onLevelEnd`. App decides which
 * screen comes next. The score starts at 0 in every level.
 *
 * Slicing (Day 3A, part 2): the same effect also listens to the index fingertip readings that
 * App's hand tracker already publishes (see useHandTracker.ts), converts each one into canvas
 * pixels, and hands it to src/game/slicing.ts. No camera or MediaPipe code lives here.
 */
interface GameCanvasProps {
  /**
   * True while the game is paused: the loop stops (nothing spawns, moves, ages or scores, the soy
   * sauce clock stands still) and fingertip readings are ignored, but every piece of game state
   * is kept, and the last frame stays on screen. False resumes exactly where it stopped.
   */
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
  paused = false,
  onScoreChange,
  level,
  startingLives,
  onLevelEnd,
  onSecondsLeftChange,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { subscribe, video } = useHandTracking()

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
    }
    const fingertip = createFingertip()
    const popups: ScorePopup[] = []
    // The same two arrays every frame; slicing.ts only ever empties them in place.
    const effects = { trail: fingertip.trail, popups }

    const update = (deltaSeconds: number) => {
      if (ended) return // game over: no spawning, no movement, no timers
      if (!hasArea(view)) return // hidden or zero-sized: nothing to move across yet
      secondsSincePenalty += deltaSeconds
      updateSushiSpawner(spawner, deltaSeconds, view, config)
      updateScoreState(scoreState, deltaSeconds) // the soy sauce bonus counts down in the same loop
      ageFingertipTrail(fingertip, deltaSeconds)
      ageScorePopups(popups, deltaSeconds)
      tickLevelClock(levelClock, deltaSeconds) // so does the level clock
      reportSeconds()
      checkLevelEnd() // time up (or anything else that ended the level this frame)
    }

    const render = () => {
      hud.lives = scoreState.lives
      hud.penalty = Math.max(0, 1 - secondsSincePenalty / PENALTY_FADE_SECONDS)
      hud.soyRemaining = scoreState.soyRemaining
      renderFrame(ctx, view, spawner.sushi, colors, effects, hud)
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
    const unsubscribe = subscribe((sample) => {
      if (ended) return // game over: readings no longer cut or score anything
      if (isPaused) return // paused: readings do nothing (the trail was cleared when pausing)

      // Tracking lost, or too unsure to report a hand (the tracker applies its confidence
      // thresholds before it publishes anything): forget the old position and the trail.
      if (!sample) {
        resetFingertip(fingertip)
        return
      }

      // The tracker says this reading follows a gap (hand lost, camera restarted, tab in the
      // background): a fresh sequence, so nothing before it may be joined to it.
      if (sample.previous === null) resetFingertip(fingertip)

      const position = toCanvasPosition(sample.point, videoRef.current, canvas)
      if (!position) {
        // The fingertip is not on the visible play area (or the video is not showing).
        resetFingertip(fingertip)
        return
      }

      const swipe = advanceFingertip(fingertip, position, sample.timestamp, view)
      if (!swipe) return // first reading of a sequence: nothing to cut with yet

      // One swipe can cut several objects. Each one can only be cut once (trySliceSushi).
      cuts.length = 0
      for (const object of spawner.sushi) {
        if (trySliceSushi(object, swipe, fingertip)) cuts.push(object)
      }
      if (cuts.length === 0) return

      // Turn the cuts into points, the soy sauce bonus or lost lives (src/game/scoring.ts), then
      // show the matching feedback.
      resolveCuts(scoreState, cuts, config, outcome)
      for (const award of outcome.awards) addScorePopup(popups, award.sushi, view, award.points)
      if (outcome.awards.length > 0) onScoreChangeRef.current?.(scoreState.score)

      if (outcome.wasabiHits.length > 0) {
        for (const wasabi of outcome.wasabiHits) addPenaltyPopup(popups, wasabi, view, '-1 life')
        secondsSincePenalty = 0 // restarts the edge frame
        playSound('wasabi-hit') // silent if the manifest has no file for it
      }

      checkLevelEnd() // this swipe may have reached the target or taken the last life
    })

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
      if (outcome) finishLevel(outcome)
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
