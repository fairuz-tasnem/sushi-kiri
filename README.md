# Sushi Kiri

Sushi Kiri is a small browser game where you slice sushi with your hands, using only a camera, and earn a score.

**Current stage: Day 3A, Task 6 (gesture commands).** The Day 1 front end (eleven screens and navigation) shows your live webcam, a cursor follows the tip of your index finger, and on the Game screen sushi of four types, a soy sauce bottle and a wasabi are launched over time. Slicing a sushi scores 10; slicing a soy sauce bottle doubles sushi scores for 5 seconds. You have 3 lives; slicing a wasabi costs one, and at 0 the Game Over screen opens. There are no levels yet.

## Hand gestures

With the camera on, three held poses act as commands (recognition: `src/vision/gestures.ts`; which screen each one opens: `src/game/gestureCommands.ts`). A small hint at the top of the window names each recognized gesture. Mouse and keyboard always work as before.

| Gesture | Hold | Where | Result |
|---|---|---|---|
| Thumbs-up | 0.8 s | Main menu | Starts the game |
| Thumbs-up | 0.8 s | Paused | Resumes the same game |
| Open palm | 0.8 s | Playing | Pauses (the game is frozen, not restarted) |
| V-sign | 1.0 s | Playing, Paused, Game Over (and the other result screens) | Main menu |
| V-sign | 1.0 s | Main menu | Goodbye screen (needs a separate, repeated V-sign) |

After a command, hold-to-repeat is blocked: change your pose, wait out the 1.5 s cooldown, and hold again. Pointing with one finger (slicing) is never a command. The camera starts when you open Calibration (or the Game screen), so open Calibration once before using gestures on the main menu. The Goodbye screen never closes the browser tab.

## Tech stack

- [React](https://react.dev/) 19 with TypeScript
- [Vite](https://vite.dev/) for the dev server and production build
- Plain CSS (no CSS framework, no UI library)
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js) (`@mediapipe/tasks-vision`) Hand Landmarker for hand tracking, using Google's ready-made model (nothing is trained)
- Canvas 2D for gameplay (the flying sushi, the fingertip trail and the slice effects)

There is no backend, no database and no router library. The only runtime dependencies are `react`, `react-dom` and `@mediapipe/tasks-vision`.

## Getting started (VS Code)

You need Node.js **20.19 or newer** (or 22.12 or newer) and npm. Check with `node -v`.

1. Open the `sushi-kiri` folder in VS Code (File > Open Folder).
2. Open the built-in terminal (Terminal > New Terminal).
3. Run these commands:

```bash
# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

The terminal prints a local address, usually `http://localhost:5173/`. Open it in your browser (Ctrl+click or Cmd+click the link in VS Code). Press `Ctrl+C` in the terminal to stop the server.

Other commands:

```bash
# Check the TypeScript code for errors
npm run typecheck

# Run the gesture-recognition tests (fixed landmark fixtures, no camera; needs Node 22.6 or newer)
npm test

# Type-check, then create the production build in the dist/ folder
npm run build

# Serve the production build locally to look at it
npm run preview
```

## Project structure

```
sushi-kiri/
  index.html                 Page shell that Vite loads
  public/
    game-assets/             Future image and audio files, one folder per kind
      sushi/  powerups/  hazards/  ui/  backgrounds/  effects/  audio/
  src/
    main.tsx                 Starts React
    App.tsx                  Holds the one "current screen" state, owns the camera, and renders the webcam video
    camera/
      useCameraStream.ts     Asks the browser for the webcam (getUserMedia) and stops it on teardown
      CameraContext.ts       Lets any screen read the camera status via useCamera()
      cameraMessages.ts      The camera status texts shown to the player
    vision/
      handTracker.ts         Wraps MediaPipe Hand Landmarker: loads the model, returns the index fingertip for one video frame
      coordinateMapper.ts    Turns a fingertip position in the camera frame into window pixels (mirroring and object-fit: cover)
      useHandTracker.ts      Owns the model and the single frame loop; reports the tracking status and fingertip readings
      HandTrackingContext.ts Lets any screen read the tracking status via useHandTracking()
      trackingMessages.ts    The tracking status texts shown to the player
    game/
      gameScreen.ts          The screen state model: the list of screens and their labels
      assetManifest.ts       Typed manifest for future assets (placeholder entries only; the four sushi types are listed here)
      gameConfig.ts          Gameplay tuning numbers in one place: spawn timing, launch height and speed, gravity, lifetimes, points, soy sauce time and multiplier, lives
      levelConfig.ts         The five levels as plain numbers to tune: target score, 60 s length, spawn interval, object speed (not used by the game yet)
      scoring.ts             The rules of a game (no React, no DOM): score, the soy sauce bonus clock, lives, game over, once-only guards
      audio.ts               playSound(id): plays a sound from the manifest, silent and safe when the file is missing or blocked
      gameLoop.ts            requestAnimationFrame loop with delta time; start/stop, never two loops
      canvasView.ts          Sizes the Canvas to the window and the screen's pixel density
      sushi.ts               One flying sushi: its state, how it is launched from the config, its arc through the air, whether it has been cut, and when it is finished
      sushiSpawner.ts        Decides when to launch a sushi, keeps the list of flying sushi, moves them and removes the finished ones (no React, no DOM)
      slicing.ts             Slicing rules (no React, no DOM): swipe line, jump check, trail, collision, one-time cut, score popups
      renderer.ts            Draws a frame: clears the Canvas, then paints the sushi (whole or cut), the score popup and the fingertip trail
    screens/                 One file per screen, plus CurrentScreen.tsx which picks the right one
    components/              Shared pieces: Button, ScreenFrame, WebcamPreview, CameraNotice, TrackingNotice, HandCursor, GameCanvas, decorations
    hooks/                   useFocusOnMount (moves keyboard focus to the new screen's heading)
    styles/                  Plain CSS: tokens (colours, fonts), base, components, screens
```

### How navigation works

`src/game/gameScreen.ts` lists every screen name. `App.tsx` keeps exactly one of those names in state, and every screen receives an `onNavigate` function that changes it. That is the whole system. To add a screen, follow the three steps in the comment at the top of `gameScreen.ts`.

### Assets

The folders in `public/game-assets/` are empty (each holds only a `.gitkeep` file). No image or audio files exist yet. `src/game/assetManifest.ts` has one placeholder entry per folder with `file: null` (the `sushi` folder has four, one per sushi type, and `powerups` has the soy sauce bottle, `hazards` the wasabi and `audio` the wasabi sound), and explains how to add real file names later.

### Fonts

The three display fonts named in the design brief (Ombre Nouveau, Peachy Naught, Wildflower Garden) are **not included**, because the font files were not supplied. Titles currently use a system serif font (Georgia, with fallbacks). Body text and buttons use the system sans-serif font.

To add one of the fonts, once you have the file and its licence allows web use:

1. Copy the file (for example `my-font.woff2`) into a new `public/fonts/` folder.
2. Add this to the top of `src/styles/tokens.css`, using your real file name:

   ```css
   @font-face {
     font-family: 'My Display Font';
     src: url('/fonts/my-font.woff2') format('woff2');
     font-display: swap;
   }
   ```

3. Put the font name first in `--font-display` in the same file: `--font-display: 'My Display Font', Georgia, serif;`

## What is a placeholder, and what comes next

Working in Day 1:

- Start screen with working navigation to Instructions, Settings and Calibration
- "Back to start" buttons on every other screen
- A single screen state model, with no router or state library
- The fixed "Camera preview appears here" panel, visible on every screen until the camera starts

Placeholders (static, clearly labelled on screen, nothing behind them yet):

- **Calibration**: turns the camera on and shows it with the fingertip cursor on top; there is no hand calibration yet
- **Game, Pause, Level Complete, Level Failed, Game Over, Victory**: reserved for gameplay
- **Settings**: lists the areas set aside for later (camera, sound) but has no controls
- **Instructions**: a draft that describes the plan, not a working game
- **Asset manifest and asset folders**: structure only, no files

Because nothing leads into the gameplay screens yet, the **development server** (`npm run dev`) shows a small "Dev only: jump to screen" panel in the bottom-left corner. It lets you open any of the ten screens directly to review them. It is left out of the production build.

## Webcam (Day 2, part 1)

How it works:

- The camera is requested **only** when the Calibration or Game screen opens. The browser's permission prompt appears then, not at page load.
- `App.tsx` owns the camera, so changing screens never restarts it. The stream is stopped only when the app unmounts (the page closes or reloads).
- There is one `<video>` element for the whole session, mirrored in CSS like a mirror, with `object-fit: cover` so it is cropped rather than stretched.
- **Game screen:** the live video fills the whole window behind the existing screen content. Every other screen shows it as the small fixed preview in the bottom-right corner.
- If the camera is blocked, missing or still starting, the small preview shows a short message, and Calibration and Game show a longer explanation with a **Try camera again** button. The Game screen keeps its normal look until the camera is running.

Camera troubleshooting:

- **"Camera permission was blocked"**: click the camera or lock icon next to the address bar, set Camera to Allow, then press **Try camera again**.
- **"Camera not available"**: plug the camera in, close other apps that use it (video calls, other browser tabs), then press **Try camera again**. The camera only works on `localhost` or `https` addresses, not on a plain `http://` network address.

Manual test steps (run `npm run dev`, open the localhost address):

1. Start screen: the corner shows "Camera preview appears here", and no permission prompt appears.
2. Click **Calibration**: the browser asks for camera permission. Allow it. The corner preview shows you, mirrored (raise your right hand: it should appear on the right side of the picture).
3. Click **Back to start**, then **Instructions** and **Settings**: the preview stays live and the camera light does not blink off and on.
4. Open the **Dev only: jump to screen** panel and choose **Game**: your live video fills the whole window with the "Game" card on top, and **Back to start** still works.
5. Jump to **Pause**, **Level Complete**, **Level Failed**, **Game Over** and **Victory**: the video returns to the small corner preview each time and never restarts.
6. Repeat from a fresh reload but choose **Block** at the prompt: you should see the "Camera permission was blocked" message. Allow the camera in the browser, press **Try camera again**, and the video starts.

## Hand tracking (Day 2, part 2)

How it works:

- `App.tsx` starts hand tracking when the camera becomes ready. It reads the **same** `<video>` element that shows the camera, so there is still one camera stream and no second one is requested.
- The hand model loads **once**. One loop then looks at each new video frame (`requestVideoFrameCallback`, or `requestAnimationFrame` in browsers without it) and asks MediaPipe for one hand. It uses landmark 8, the tip of the index finger.
- MediaPipe reports the fingertip on the raw camera picture. `coordinateMapper.ts` converts it to window pixels by applying the same two changes the page applies to the video: `object-fit: cover` cropping, then the left-to-right mirror. That is why the cursor stays on your fingertip even when the video is cropped to fill the window.
- The cursor is drawn on the **Calibration** screen (over the small camera preview) and the **Game** screen (over the full-window video). Tracking keeps running on every other screen, but the cursor is only drawn on those two.
- When the hand is lost, the cursor is hidden at once and its previous position is forgotten, so the next reading starts fresh and nothing is ever joined across a gap. Each reading carries a `previous` field that is `null` for the first reading after a gap, ready for slicing to use later.
- Tracking and the model are stopped and freed only when the app unmounts (the page closes or reloads) or when the camera itself goes away.

The tracking status is shown on the Calibration and Game screens: **Loading hand tracking…**, **Hand detected**, **Hand not detected**, or **Hand tracking unavailable** (with a **Try tracking again** button).

Internet needed: the first time tracking starts, the browser downloads the MediaPipe runtime (from the jsDelivr CDN) and the hand model, about 8 MB (from Google's model storage). After that the browser keeps them. To work fully offline, see the comment at the top of `src/vision/handTracker.ts`. If you ever update `@mediapipe/tasks-vision`, change `TASKS_VISION_VERSION` in that file to the same version.

Manual test steps (run `npm run dev`, open the localhost address):

1. Click **Calibration** and allow the camera. The small preview shows **Loading hand tracking…** for a few seconds, then **Hand not detected**.
2. Hold one hand up. The notice changes to **Hand detected** and a dark-ringed orange dot appears on the tip of your index finger in the preview.
3. Move your finger to the left side of the picture: the dot moves to the left side too (it follows the mirrored image). Try all four corners.
4. Lower your hand out of view: the dot disappears immediately. Raise it again: the dot reappears under your fingertip, with no streak from the old position.
5. Open **Dev only: jump to screen** and choose **Game**: the video fills the window and the dot follows your fingertip over it, including over the Game card.
6. Resize the browser window to a very tall and then a very wide shape (the video is cropped differently each time). The dot must stay on your fingertip. A fingertip in a part of the picture that is cropped off-screen has no dot.
7. Jump to **Pause**, **Level Complete** and back to **Game**: the camera light never blinks, there is no new "Loading" message, and the dot is back as soon as you return to Game.
8. Disconnect from the internet, hard-reload and open **Calibration** with an empty browser cache: the notice shows **Hand tracking unavailable** with a retry button. Reconnect and press **Try tracking again**.

Slicing and scoring are described in the Day 3A part 2 section below. Levels and audio are not built yet.

## Game canvas (Day 3A, part 1)

What exists: the Game screen has a full-window, transparent Canvas 2D layer with **one** moving test sushi. (Part 2, below, adds slicing, the trail and the score on top of it.)

How it works:

- `GameCanvas.tsx` is rendered only by the Game screen, so its loop starts when the screen opens and stops when it closes. `gameLoop.ts` ignores a second `start()`, so there is never more than one loop.
- Motion uses delta time (seconds since the last frame, capped at 0.05 s), so speed does not depend on the screen's refresh rate.
- The sushi is thrown up from just below the bottom edge, peaks about a quarter of the way down from the top, and falls out of the bottom. The same object is then launched again from the other side.
- The Canvas works in CSS pixels with (0, 0) at the window's top-left, which is the same space the fingertip cursor is mapped into. Its pixel buffer is resized (with the screen's pixel ratio, capped at 2) whenever the window changes size.
- The Canvas sits above the placeholder card (so the sushi is never hidden behind it) and below the camera panel and the fingertip cursor. It ignores the mouse, so buttons still work. The layer order is one `z-index` in `.game-canvas` (`src/styles/components.css`).
- No sushi image exists yet (`public/game-assets/sushi/` is empty and the manifest entry has `file: null`), so the sushi is a pink-and-cream block labelled "SUSHI placeholder".

Known limits in this part:

- Leaving the Game screen (for example to Pause) discards the sushi and the score; coming back starts fresh. Pause and resume without losing state belong to Day 5.
- If a window is moved to a screen with a different pixel density without being resized, the Canvas stays at the old density until the next resize.

## Slicing and scoring (Day 3A, part 2)

What exists: on the Game screen you slice the one flying test sushi by swiping your index fingertip through it. A cut sushi splits into two halves with a bright flash along the cut, a `+10` rises from it, and the **Score** on the Game card goes up. A short, fading trail follows your fingertip while tracking is good. (Task 2 below replaced the single test sushi with a spawner; the slicing rules in this section are unchanged and apply to every sushi.)

How it works:

- `GameCanvas.tsx` subscribes to the fingertip readings that `useHandTracker` already publishes (the same ones the cursor uses). `useHandTracker` now also exposes the `<video>` element it reads (`video` on the tracking state), because turning a reading into pixels needs that element's size and position. Nothing about the camera or MediaPipe setup changed.
- Each reading is converted exactly like the cursor's: `coordinateMapper.ts` applies `object-fit: cover` and the mirror flip, giving a window position, and the canvas's own position is then subtracted. So a slice happens where the cursor is drawn.
- A swipe is the **line between the previous good reading and the current one**. `slicing.ts` tests that whole line against the sushi's collision circle (its radius plus 6 px of reach), not just the point where the fingertip is now. A fast swipe that jumps clean across the sushi between two readings still cuts it, and a slow swipe cuts it as soon as the line touches the edge. There is no minimum speed.
- The first cut sets `sushi.slice`; a sushi that is already cut can never score again. Every launched sushi (`spawnSushi`) is a new, whole object, so you can score once per sushi. Each cut is worth `pointsPerSushi` (10, in `gameConfig.ts`; Task 3 below).
- The halves part at right angles to the swipe, which is why the cut follows the direction you swiped.

What counts as "tracking trouble" (the previous position and the trail are cleared at once, and the next good reading only starts a new swipe, so nothing is ever joined across a gap):

- The tracker publishes `null`: the hand is lost, or MediaPipe is below its own confidence thresholds (`handTracker.ts`). The tracker exposes no separate confidence number, so this is the confidence signal that is reused.
- A reading arrives with `previous === null`: the tracker's marker for the first reading after a gap (hand lost, tab in the background, readings more than 300 ms apart).
- The fingertip is outside the visible play area (for example in a part of the camera picture that `object-fit: cover` cropped off), or the video is not showing.
- The fingertip moved further than a hand plausibly can in the time that passed (`MAX_SPEED_DIAGONALS_PER_SECOND` and `MIN_JUMP_DIAGONALS` in `slicing.ts`; the limit is generous so real fast swipes pass).
- The window is resized.

The first reading of a new swipe cannot cut anything (it has nothing to be joined to); slicing resumes with the next good reading, about one camera frame later.

Loops and cleanup: there is still exactly one game loop. When the Game screen closes, the effect in `GameCanvas.tsx` stops listening to the fingertip, stops the loop, stops watching for resizes and forgets the swipe.

Manual test steps (run `npm run dev`, open the localhost address, choose **Calibration** once to allow the camera, then open the **Game** screen):

1. Wait for **Hand detected**. Move your index finger slowly through the sushi: it splits, a `+10` rises, the Score reads 10, and a fading trail follows your fingertip.
2. Keep swiping through the cut sushi: the score stays at 10. When the next sushi flies in (it is whole again), cut it: the score goes to 20.
3. Swipe fast, clean across a sushi: it still splits.
4. Swipe so the trail passes beside the sushi without touching it: nothing is cut.
5. Swipe toward the sushi, then drop your hand out of view and bring it back on the other side: the trail disappears the moment the hand is lost, no line is drawn between the two places, and the sushi is not cut by the "jump". Swiping again cuts it as normal.
6. Move your hand to the very edge of the picture and back: no trail across the gap.
7. Check that the cursor still follows your fingertip, **Back to start** still works, and going to Calibration and back to Game still works with no second camera light or loading message.

Known limits in this part:

- The collision shape is a circle of the sushi's radius plus 6 px of reach. The placeholder drawing is a rounded block that sits inside that circle, so a swipe that passes just beside a flat side of the drawing (roughly 20 to 30 px away, depending on the window size) can still count as a cut. This is deliberately a little generous, because camera readings wobble by a few pixels.
- The jump limit is tuned for a normal webcam; if you change the camera's frame rate a lot, check that fast swipes still pass.
- The score is not saved or shown anywhere but the Game card, and it resets when you leave the Game screen. Levels and result screens come later.

## Sushi spawning and movement (Day 3A, Task 2)

What exists: on the Game screen a new placeholder sushi is launched from just below the bottom edge every 0.8 to 1.6 seconds, flies in an arc and falls back out. Several can be on screen at once (at most 5). There are four types, taken from `assetManifest.ts`: `salmon-nigiri`, `maki-roll`, `egg-nigiri` and `shrimp-nigiri`. No art exists yet, so each is drawn as a spinning block with its name (SALMON, MAKI, EGG, SHRIMP) over the word `placeholder` and its own topping colour. Slicing and the score work as before, on every sushi. There is no level progression. (Soy sauce came in Task 3, wasabi and lives in Task 4.)

Where the numbers live: `src/game/gameConfig.ts`. The ones used now are `firstSpawnDelaySeconds`, `spawnIntervalSeconds`, `maxObjectsOnScreen`, `apexFromTop` and `horizontalSpeedWidths` (together these set the initial velocity: how high a sushi peaks fixes its upward speed, and the second fixes its sideways speed, both scaled to the window), `gravityPerHeight`, `maxObjectLifetimeSeconds` and `slicedPieceLifetimeSeconds`. `startingLives` is listed for a later task and nothing reads it yet. (Task 3 added the scoring and soy sauce settings.)

How it works:

- `sushiSpawner.ts` holds the list of sushi and a countdown to the next launch. `GameCanvas.tsx` creates one spawner when it mounts and calls `updateSushiSpawner` from the existing game loop's `update()`. There is still exactly one loop.
- Every frame: move each sushi by `deltaSeconds`, remove the finished ones, then count the timer down and launch if it reached zero. Movement uses the exact constant-gravity formula, so a flight is the same at any frame rate.
- A sushi is removed when it falls below the bottom edge, when it has been alive longer than `maxObjectLifetimeSeconds` (a safety net), when its cut pieces have been visible for `slicedPieceLifetimeSeconds` (they fade out over the last 0.25 s), or when it is outside a side edge and still moving away. The list therefore cannot grow without limit.
- Launch position along the bottom, peak height, sideways speed and spin are random within the config ranges. The sideways speed is capped so a sushi never leaves the left or right side while it is on screen.
- If the screen already holds `maxObjectsOnScreen` sushi when a launch is due, that launch is skipped (not queued).
- **Stopping outside the Playing state:** `GameCanvas` exists only on the Game screen, and its cleanup stops the loop. So on Pause, Game Over or any other screen nothing spawns and nothing moves. Opening the Game screen again creates a new, empty spawner.

Manual test steps (run `npm run dev`, choose **Calibration** once to allow the camera, then open the **Game** screen):

1. About half a second after the screen opens, a sushi appears from the bottom. More follow every second or so; you should see 2 or 3 in the air at the same time, of different types and colours, each labelled.
2. Watch for a minute: sushi keep coming, none get stuck on screen, none fly out of the left or right side, and the animation stays smooth.
3. Cut a sushi: it splits, fades out within about half a second, and the score goes up by 10. Swiping through the same sushi again does not score again. Cut two sushi in one swipe: the score goes up by 20.
4. Use the **Dev only: jump to screen** panel to open **Pause** (and **Game Over**): nothing is drawn or moving there. Jump back to **Game**: the field starts empty and the first sushi appears after about half a second.
5. Switch to another browser tab for a few seconds and come back: no burst of sushi appears, and flying sushi continue from where they were.
6. Resize the window while playing: sushi keep flying and are removed normally; new ones fit the new size.
7. Check that the camera background, the fingertip cursor and **Back to start** all still work.

Known limits in this part:

- No sushi artwork is drawn yet. A file added to the manifest is not loaded until the art-integration step, so every type still shows its placeholder.
- Pause does not keep the field alive: leaving the Game screen discards every sushi and the score. Pause and resume without losing state belong to Day 5.
- Spawn positions do not yet avoid the info card on the left or the HUD. Sushi can fly behind them.
- The numbers in `gameConfig.ts` are starting values and have not been tuned by playing.

## Scoring and soy sauce (Day 3A, Task 3)

What exists: cutting a sushi adds 10 to the **Score** on the Game card. A soy sauce bottle (a labelled placeholder: a dark bottle with a red cap, `SOY` over `placeholder`) is launched now and then, at most one at a time. Cutting it starts a **double-points bonus for exactly 5 seconds**: a badge appears at the top right of the screen showing `SOY SAUCE x2`, the seconds left and a bar that empties. Sushi cut while the badge is showing score 20 (and the `+20` popup says so). When the time runs out the badge disappears and sushi are worth 10 again. (Lives and wasabi came in Task 4, below.)

Where the numbers live (`src/game/gameConfig.ts`): `pointsPerSushi` (10), `soySauceMultiplier` (2), `soySauceDurationSeconds` (5), `soySauceSpawnChance` (0.15 per launch, only when no bottle is already on screen) and `maxSoySauceOnScreen` (1).

How it works:

- `scoring.ts` holds a `ScoreState` (the score and the seconds of bonus left). `GameCanvas.tsx` creates it when the Game screen opens, so every visit starts at score 0 with no bonus.
- **One timer, one loop.** The bonus counts down in `updateScoreState`, called from the same `update(deltaSeconds)` of the existing game loop as the spawner. There is no second loop and no `setTimeout`. The badge is drawn on the Canvas by `renderer.ts` from that same state, so it never causes React re-renders. Because it counts game time, the bonus freezes when the browser throttles a hidden tab (the loop's time step is capped at 0.05 s).
- **Once-only guards.** (1) `slicing.ts`: an object that has been cut can never be cut again. (2) `applyCut` in `scoring.ts` refuses an object that was never cut or is already `claimed`, and marks it claimed before doing anything. So a sushi can only score once and one bottle can only start the bonus once, even if the same object were handed over twice.
- **What the multiplier touches.** Only the points of a sushi cut while the bonus is running. It does not change `pointsPerSushi`, bottles score nothing, and sushi cut before the bonus started or after it ended are worth 10.
- **A second bottle while the bonus is running** restarts the clock to the full 5 seconds. The multiplier does not stack (it stays x2).
- **One swipe through a bottle and a sushi:** the bottle is applied first, so that sushi already gets x2, whatever order they happen to be in.
- Expiry: the clock only goes down. A tiny rounding leftover is treated as 0, so the bonus never lasts an extra frame.

Manual test steps (run `npm run dev`, choose **Calibration** once to allow the camera, then open the **Game** screen):

1. Cut ordinary sushi: each cut adds 10 and shows `+10`. Swipe through the same cut sushi again: no change.
2. Wait for a soy sauce bottle (about one launch in eight, so usually within 5 to 20 seconds). It should be clearly a bottle, not a sushi block. Cut it: the badge appears at the top right at `5.0s` and counts down smoothly.
3. While the badge shows, cut sushi: each shows `+20` and adds 20. Count about 5 seconds on a clock: the badge disappears at 0.
4. Cut a sushi right after the badge disappears: back to `+10`.
5. Cut a second bottle while the badge is still showing: the time jumps back to 5.0 and sushi are still `+20`, not `+40`.
6. Cut a bottle and a sushi with one swipe if you can: the sushi shows `+20`.
7. Use **Back to start**, or the dev panel's Pause, mid-bonus, then open the Game screen again: score is 0 and there is no badge.
8. Check the badge does not overlap the Game card (it is on the right; in a narrow window the two can touch), and that the cursor, trail and camera still work.

Known limits in this part:

- No soy sauce artwork exists, so the bottle is a placeholder; a file added to the manifest is not loaded yet.
- The bonus is lost when you leave the Game screen (so is the score). Pausing without losing state belongs to Day 5.
- The badge is on the Canvas and aria-hidden. A screen reader is not told when the bonus starts or ends (slicing needs a camera and hand movements anyway).
- The card's Score line and the badge can overlap in a narrow window (under about 900 px wide).
- `soySauceSpawnChance` and the other numbers are starting values and have not been tuned by playing.

## Wasabi, lives and Game Over (Day 3A, Task 4)

What exists: every game starts with **3 lives**, shown as hearts at the top right (a filled heart is a life left, an outline is a life lost). A **wasabi** (a labelled placeholder: a green swirl with an angry face inside a red dashed warning ring, `WASABI` over `placeholder`) is launched now and then, at most one at a time. **Slicing it costs exactly one life**; letting it fall past uncut costs nothing. The hit shows a `-1 life` popup, an edge frame in dark red that fades out over half a second (it frames the screen edge, so the middle stays clear, and it fades once per hit rather than blinking) and plays the `wasabi-hit` sound if one exists. When the last life goes, the **Game Over** screen opens at once and shows the final score. **Play again** opens a new game; **Back to start** goes to the start screen. There are no levels, and no pause yet.

Where the numbers live (`src/game/gameConfig.ts`): `startingLives` (3), `wasabiSpawnChance` (0.2) and `maxWasabiOnScreen` (1). Each launch makes one random roll that is split like a strip: the first 15% is a soy sauce bottle (if none is on screen), the next 20% a wasabi (if none is on screen), the rest sushi. So the chances are really the configured numbers and do not disturb each other. In long runs about 72% of launches are sushi, 12% soy sauce and 16% wasabi.

How it works:

- **Lives** are part of `ScoreState` in `scoring.ts`. A new game is a new `ScoreState` with `startingLives` lives, score 0 and no bonus. Lives never go below 0.
- **One life per wasabi.** The same two once-only guards as for points apply: an object that has been cut cannot be cut again (`slicing.ts`), and `applyCut` marks an object `claimed` before it does anything, so the same wasabi can never take a second life. Cutting a wasabi changes nothing else: not the score, not the soy sauce bonus or its countdown. The x2 multiplier applies to sushi points only.
- **One swipe, several objects:** bottles are applied first, then sushi, then wasabi, whatever order they are in. So a sushi cut in the same swipe that takes your last life still scores. Once lives are 0, nothing is applied any more (no points, no bonus, no life loss).
- **Game Over stops everything at once.** When `GameCanvas` sees 0 lives it ends the game in this order: mark it ended (so the update step and the fingertip listener do nothing from then on), draw one last frame, stop the loop and the listener, and only then call `onGameOver(finalScore)`. The Game screen passes the score up to `App` and opens `gameOver`. Nothing spawns, moves, scores or draws afterwards.
- **Restart.** Leaving the Game screen unmounts the canvas, and opening it again mounts a new one, which creates a new `ScoreState`, spawner, popups and fingertip sequence. So lives, score, bonus, flying objects and the fading frame all start fresh. The only thing `App` keeps between games is the last final score, for the Game Over screen.
- **Sound.** `audio.ts` plays the id `wasabi-hit` from the manifest's `audio` list. Its `file` is `null` today, so the game is silent. To add the sound, put the file in `public/game-assets/audio/` and set `file` on that manifest entry; no code change is needed. If the file is listed but missing or not playable, or the browser blocks sound, nothing breaks; in development builds one warning is printed in the console. There are no volume controls yet.

Manual test steps (run `npm run dev`, choose **Calibration** once to allow the camera, then open the **Game** screen with the development panel):

1. Three filled hearts at the top right. Cut some sushi: scoring works as before.
2. Wait for a wasabi (about one launch in six). It should be clearly different from the sushi and the bottle. Let one fall without cutting it: nothing happens.
3. Cut a wasabi: one heart becomes an outline, `-1 life` rises from it, a dark red frame appears at the screen edge and fades in about half a second, and the score does not change. Swipe through the same wasabi again: no second life is lost.
4. Cut a soy sauce bottle, then a wasabi while the badge is showing: one life is lost, the badge and its countdown carry on, and sushi are still worth 20.
5. Cut the third wasabi: the Game Over screen opens at once, shows `Final score`, and the camera preview is in the corner.
6. Press **Play again**: a new game with 3 hearts, `Score: 0`, no soy badge and an empty field. Press **Back to start** from Game Over: the start screen.
7. Sound: nothing is expected to play. To try it, add a short sound file named `wasabi_hit.wav` to `public/game-assets/audio/`, set `file: 'wasabi_hit.wav'` on the `wasabi-hit` entry of the `audio` list in `src/game/assetManifest.ts`, reload, and cut a wasabi. If your browser blocks it, click anywhere on the page first.
8. Check that the camera, cursor, trail and the Back to start button on the Game card still work.

Known limits in this part:

- There is no pause between the last hit and the Game Over screen (you asked for an immediate stop), so you will not see the last `-1 life` popup or the fade; the screen changes right away.
- The Game Over screen shows only the score. A highest-level record belongs to the level work. **Play again** goes straight back to the Game screen (the camera is already running).
- Pause still discards the game when you leave the Game screen; pausing without losing state belongs to Day 5.
- The hearts, the red frame and the popups are drawn on the Canvas, so a screen reader is not told about lives. (The score and the final score are announced.)
- No wasabi artwork or sound exists. A file added to the manifest is not loaded until the art step (sounds are the exception: they play as soon as a file is listed).
- Wasabi can fly behind the Game card, and the numbers in `gameConfig.ts` are starting values that have not been tuned by playing.

## Level configuration (Day 5, part 1)

What exists: `src/game/levelConfig.ts` defines the five levels as plain numbers. **Nothing uses it yet**: there is no level switching, timer or new screen, and the game plays exactly as before. Wiring the levels in is a later part.

| Level | Target score | Length | Wait between launches (s) | Gravity | Sideways speed (canvas widths/s) |
|---|---|---|---|---|---|
| 1 | 100 | 60 s | 0.8 to 1.6 | 1.1 | 0.05 to 0.20 |
| 2 | 180 | 60 s | 0.725 to 1.45 | 1.25 | 0.06 to 0.22 |
| 3 | 260 | 60 s | 0.65 to 1.3 | 1.4 | 0.07 to 0.24 |
| 4 | 350 | 60 s | 0.575 to 1.15 | 1.55 | 0.08 to 0.26 |
| 5 | 450 | 60 s | 0.5 to 1.0 | 1.7 | 0.09 to 0.28 |

- **Spawn rate** is the wait between two launches (`spawnIntervalSeconds`, the same setting as in `gameConfig.ts`). A shorter wait means more sushi, so these numbers go down as the levels go up.
- **Object speed** is `gravityPerHeight` (higher gravity throws an object up faster and brings it down faster, to the same height) and `horizontalSpeedWidths` (how fast it drifts sideways). Both go up with the level. The three fields have the same names and units as in `gameConfig.ts`, so a later part can hand a level's numbers to the existing spawner without changing it.
- To tune: edit the numbers in `levelConfigs`. `LEVEL_DURATION_SECONDS` sets the length of all five levels at once. `npm test` checks that there are five levels, the targets and 60 s lengths are as listed, every range is valid, and the difficulty still rises from level to level.
- Level 1 uses today's `gameConfig.ts` numbers. Everything else (lives, points, soy sauce, wasabi chances, `maxObjectsOnScreen`, peak height) stays in `gameConfig.ts` and is the same on every level.
- Whether the score restarts at 0 on each level or keeps adding up is not decided here; `targetScore` is only a number.
- The values are starting points that have not been tuned by playing.
