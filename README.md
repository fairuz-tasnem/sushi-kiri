# Sushi Kiri

A webcam sushi-slicing game built with the existing React + TypeScript + Vite project, Canvas 2D and MediaPipe Hand Landmarker. No backend, accounts or custom-trained recognition model.

## Run locally

Use Node.js 24 (the version used for validation) and npm. Open the `sushi-kiri` folder in VS Code, then:

```sh
npm ci
npm run dev
```

Open the printed localhost address. Select **Play**, allow the webcam, move your index finger until calibration is ready, then select **Continue**. Each level begins with a five-stage countdown: READY → 1 → 2 → 3 → GO! (one second per stage). Use localhost or HTTPS; opening `index.html` directly is not supported.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

The ZIP excludes installed dependencies, build output and Git metadata. To update an existing checkout, copy the project files into it while preserving its `.git` directory, then run `npm ci`. Nothing was pushed to GitHub.

## Rules

- Five levels, each with 60 seconds of active play. Targets: 100, 180, 260, 350, 450.
- Score resets for each level. Reaching the target ends active play immediately. A 1.6-second suspense gate reveals the result before Next Level becomes available (0.5 seconds with reduced motion). Exit cancels the reveal safely.
- Sushi: 10 points, awarded once per object. Missing objects has no penalty.
- Soy sauce never spawns twice consecutively, even if the previous bottle has left the screen. This memory survives pause/resume.
- Soy sauce: double sushi points for five seconds. Another bottle refreshes the duration without multiplying again.
- Wasabi: one life lost per object. Zero lives immediately locks spawning, scoring, slicing and game clocks, then runs a 3.6-second visual descent before Game Over, even if the same swipe reaches the target. Exit can interrupt the descent; Pause cannot.
- Start with three lives; carry remaining lives to the next level. Retry Level restores three lives. Game Over's Play Again restarts at level 1.
- Unlocked levels and best per-level scores are saved in this browser. Unlocked levels can be selected from the menu. If storage is blocked, the game remains usable and displays a warning.
- Pause freezes simulation, scoring, countdown and bonus/level clocks. Switching to another tab pauses active play automatically; an already-triggered game-over descent completes on return.

## Controls

| Action | Hand | Keyboard | Voice (opt-in) |
| --- | --- | --- | --- |
| Play | Thumbs-up, 0.8 s, on menu | Enter/Space | play / Kiri play |
| Pause | Open palm, 0.8 s | P | pause / Kiri pause |
| Resume | Thumbs-up, 0.8 s | P or Enter/Space | resume / Kiri resume |
| Exit | V-sign, 1 s | Escape | exit / Kiri exit |

Mouse buttons and Tab/Enter also operate the menus. Keyboard shortcuts ignore text/range/select controls, modifier keys, and key repeats. Slicing uses the webcam fingertip or the explicit **Use mouse fallback** option on calibration. In mouse mode, hold the left button and drag to slice; Pause lets you switch input modes. Both inputs use the same collision and scoring path and the same chopstick indicator.

Point at a visible button for **0.7 seconds** to activate it. Chopsticks mark the interaction point; a small square dwell indicator shows progress. Leave the button before activating again. A hold is canceled by hand loss. Menu pointing maps the mirrored camera coordinates across the whole viewport; gameplay pointing follows the camera's visible crop. That distinction is explained during calibration.

Pose commands have a 1.5-second cooldown and require releasing/changing the pose before repetition. Exit first returns to the menu; a separate Exit on the menu opens Goodbye and releases the camera, tracking model and microphone. The browser tab stays open.

## Camera and recognition

The camera starts on Play/calibration, then stays active through levels, pause and results. It fills the window during play and appears as a small preview on other screens. The existing MediaPipe model and confidence settings are retained. Model/WASM files download from Google storage and jsDelivr, so startup needs internet access.

If access is denied or the camera is unavailable, use **Try camera again** after correcting browser permissions or reconnecting it. If the model fails to load, use **Try tracking again**. Pause to access those recovery controls during a game. Calibration requires about 0.8 seconds of continuous tracking plus a small finger movement.

Tracking processes new video frames once and applies speed-adaptive smoothing (45 ms time constant when nearly stationary, approaching 12 ms on fast movement), and resets the blade after hand loss, a long sample gap, a large jump, resize or pause. Swipes crossing the HUD cannot slice objects behind it. Object collision retains the existing forgiving circular hit regions.

## Voice and privacy

Enable voice explicitly in Settings and allow microphone permission. Say “pause” or “resume” on the matching game screen; the same commands are intentionally ignored on other screens. A saved preference never starts the microphone automatically after a reload. The status is visible while enabled, with a Turn Voice Off button.

Only the four complete commands are accepted, with optional “Kiri” before them and optional final punctuation. Plain “pause” avoids failures when the browser mishears the name Kiri. Up to three alternative transcripts are checked. Interim speech appears as feedback but never triggers an action. Unrelated speech is ignored. Final results are consumed once and commands have a 1.5-second cooldown. Permission/service errors are shown; toggle voice off and on to retry. Normal recognition endings restart after a short delay while enabled. A real microphone meter and the last transcript show whether audio input is reaching the app and whether the speech service returned words. A moving meter without a transcript is not successful recognition. Microphone denial, missing devices and network/service failures get distinct messages; failed sessions release the mic. Music and effects are quieter while voice is enabled to reduce interference.

Browser Web Speech support varies; some browsers send audio to a vendor service. Voice is **not claimed to be offline or fully local**. See [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Brand, art and audio

`src/game/assetManifest.ts` is the single source of asset paths. Integrated originals:

- `SalmonNigiri1.png`, `SushiRollSalmon1.png`, `EggNigiri1.png`, `ShrimpNigirii1.png`
- `SoySauce1.png`, `Wasabi1.png`, `Logo1.png`

The supplied wasabi art is a tube; its silhouette and printed label distinguish it from sushi. Whole images also drive the existing clipped two-piece slice effect. Images load once, with labeled geometric fallbacks if loading fails. No new artwork was generated. Alternate logos, platter and ikura art are preserved in the accompanying original art archive but are not added to the game's runtime assets.

**Music and sound effects are included.** Asset replacements in this revision:

- `bgm-menu.ogg`: newly synthesized 32-second calm pentatonic plucks and sustained ambient tones, an original Japanese-inspired placeholder composition. Source: `scripts/generate_audio.py` (numpy/ffmpeg only needed to regenerate).
- `game-jazz.mp3`: supplied `puyopuyomegafan1234-japanese-jazz-2-385180.mp3`, copied unchanged.
- `rubber-pop.mp3`: supplied ElevenLabs crisp rubbery cartoon pop, copied unchanged; three small playback-rate variations reduce repetition.
- `game-descent.mp3`: supplied ElevenLabs slow descending game-termination melody, copied unchanged.
- `reward-reveal.ogg`: supplied ElevenLabs suspenseful reward reveal, shortened from about seven seconds to 2.8 seconds using pitch-preserving `atempo=2,atempo=1.25`, with short entrance/exit fades.
- `ui/phiruz_polished.png`: new supplied branding image, copied unchanged and displayed at bottom-left with full CSS opacity and no blend effect with alt text `φruz`.

Wasabi now uses the supplied Mixkit “Funny Fail Low Tone” WAV (`wasabi-fail.wav`). Existing button, soy, start and exit effects remain. The supplied audio's licensing was not independently established; source names are recorded here without inventing attribution or rights. No nonexistent audio paths are referenced.

Music and effects have independent saved volume controls. Playback starts after user interaction. One music player fades out before replacement, so menu and gameplay tracks do not overlap. Gameplay music plays at 42% of the selected music volume; menu music at 65%. Pause fades music out; resume fades it back in. The descent fades gameplay music out over 0.9 seconds while its termination cue plays. Exit/result unmounts cancel their pending cue. Each effect reuses its player, bounding repeated overlap. Voice mode retains its additional ducking. All runtime paths are in the central asset manifest.

The logo remains the **exact original PNG**, with only its transparent outer padding cropped by CSS. It is larger on the left; menus and secondary-screen controls are on the right on desktop. Narrow screens stack the brand above the menu and put the small camera preview after the menu to avoid covering buttons. The separate text title has been removed. The food guide correctly labels sushi +10 points, soy 2× points for five seconds and wasabi −1 life (not a score deduction).

UI display text uses bundled **Fraunces**, a soft, heavy retro serif chosen to complement the supplied lettering, not claimed to be the exact Recoleta font. See `public/fonts/OFL.txt` and [the Fraunces project](https://github.com/googlefonts/fraunces). The logo itself is not re-typeset. Controls, panels, sliders and dwell progress retain square geometry. The HUD now has three animated heart icons, as requested, plus a thin responsive gameplay border; supplied PNG art retains its original shapes. No gradients or decorative shadows are added.

The uploaded artwork had no separate attribution/license document. Its original filenames are retained; no ownership or redistribution license is inferred. Confirm the animator's credit and permission before publicly publishing the artwork. Dependencies retain their own licenses through npm.

## Code map

- `App.tsx`: persistent camera/tracker, shared action dispatch, screen/run state and saved preferences.
- `game/commands.ts`: allowed Play/Pause/Resume/Exit transitions and exact voice parser.
- `vision/`: existing MediaPipe tracker and pose classifier, plus optional browser speech hook.
- `components/HandCursor.tsx`: fingertip pointer and dwell selection.
- `components/GameCanvas.tsx`: one level's simulation and input subscription.
- `game/`: existing collision/scoring/spawning/level modules, renderer, assets and audio.
- `screens/`: actual menus, calibration, results and game HUD. `GameScreenPlaceholder.tsx` retains its historical filename but implements real gameplay.

The loop separates bounded physics steps from real active elapsed time for level/bonus clocks. This prevents slow frames from making a 60-second level last longer; no frame-rate improvement is claimed. App keeps the game mounted on pause and remounts it on retry/next level.

## Current polish revision

The existing React screen/run state and Canvas simulation remain in place. Hearts fade and shrink on loss. Chopsticks follow either selected input. Temporary tracking loss clears slicing history instead of extrapolating a stale cut. The new descent is a visual-only branch of the existing loop; the existing result callback still fires once after it. The result-screen reveal uses a cancellable timer and shared audio cleanup.

## Validation and remaining manual checks

Validation completed in this environment:

Current polish revision: 64 automated tests and the production build passed. Headless Chromium verified mouse drag slicing through the shared scoring path, life loss, the reveal gate, lives carryover, locked scoring/clock during descent, disabled Pause during descent, exit interruption during both sequences, cue cleanup and at most one active music track. No page errors remained after fixing cursor cleanup during React remounts. Synthetic hand input verified desktop/mobile HUD layout, pause/resume and exit. All included audio files decoded successfully. The supplied branding PNG is byte-for-byte unchanged. Screenshots were inspected for hearts, chopsticks, border, branding and reward layout.

Earlier revision checks (retained for context):

Revision checks: large-left-logo/right-menu layout, bundled font loading, square controls, narrow-screen overflow, music/effect decoding and playback, pause/resume and effect reuse passed in headless Chromium. Real local synthetic audio passed through the microphone meter; mocked interim/final/alternate speech results, replay rejection, network-error messages and microphone cleanup passed. The game HUD was checked at desktop and mobile widths, including an active soy bonus. The original logo bytes are unchanged.

- `npm ci`, `npm run typecheck`, `npm test` (64 tests), and `npm run build` passed.
- Headless Chromium: desktop/mobile menu layout, settings, unavailable-camera recovery UI and Exit/Goodbye passed with no page errors.
- Browser integration with an explicitly synthetic camera and injected fingertip/voice fixtures: calibration, an actual input-driven slice, frozen pause state, resume, retry, all five level/result transitions, lives carryover, persistence, dwell activation, voice-result replay protection and camera release passed with no page errors. A separate mocked microphone-permission failure and disable/recovery check also passed. Terminal conditions were injected for transition checks; this was not a human playthrough or a recognition-accuracy test.

Automated test fixtures verify gesture recognition/holds, command state rules, five-level progression, score/bonus/life rules, fast and slow collision edges, tracking-gap resets, HUD crossing, clock behavior, coordinate mapping, voice parsing and storage failures. Fixtures do not measure real recognition accuracy.

Before showing the game on your laptop:

1. Grant/deny camera permission; disconnect/reconnect the camera; block model downloads and retry.
2. Verify left/right mirroring and alignment at the edges of a resized window.
3. Slice slowly and quickly; hide and restore your hand; confirm no stale cross-screen cut.
4. Try each pose, release it and repeat. Test dwell cancellation and holding after activation.
5. Complete/fail each level, lose all lives, retry, pause mid-bonus and resume. Confirm saved scores after refresh.
6. Say all four exact voice phrases, unrelated phrases and repeated commands. Test permission denial, unsupported browser and voice off.
7. With the included audio, verify volume zero, track transitions, blocked playback and missing files with real speakers.
8. Measure frame time/input latency on the target laptop under actual webcam tracking. Difficulty and recognition thresholds have not been human-playtested here.

A headless Chromium sample of 120 animation intervals with synthetic tracking measured a 16.70 ms median and 16.80 ms p95. This excludes real MediaPipe inference and is not a laptop or recognition-latency benchmark.

Real webcam accuracy, real spoken-command recognition, speaker output on the target machine and target-laptop performance remain unverified. The generated audio files were decoded and played successfully in headless Chromium, including music pause/resume and bounded effect reuse. Microphone-level monitoring, interim transcripts, alternate final transcripts, replay protection and service-failure cleanup were tested with explicit synthetic audio and recognition fixtures; those tests do not establish real speech accuracy. No claim of fully validated hardware gameplay is made.

Final polish: the bundled retro display font now covers DOM and Canvas text. READY, HUD, tracking hints, bonus text, descent and reward reveal have no background panels. The green border is rendered above gameplay/camera layers and stays present during pause and result screens. The new logo retains its supplied transparent outside area while CSS opacity is 1.

Final update validation: 64 tests and production build passed. Browser checks covered 100 forced spawn selections without consecutive soy, supplied wasabi WAV decoding, bottom-left logo at opacity 1, transparent READY/HUD backgrounds, border during pause, slicing and transition cleanup; no page errors. Real hardware checks remain as described above.

## Latest UI refinement (supersedes earlier visual notes)

The supplied pale φruz branding is now rendered on every screen, bottom-left on an opaque forest-green backing. Gameplay, pause and result screens show the original Sushi Kiri logo bottom-right. A solid 8–14px green frame stays above the camera and game layers. Compact opaque cream surfaces restore readability for the HUD, countdown, tracking/descent hints, bonus label and results. The camera preview sits above the corner logos on small screens.

The countdown shows exactly READY, 1, 2, 3, GO!, one stage at a time. Simulation stays paused through all five stages. Pause and hand-tracking loss suspend countdown advancement; leaving the screen cancels its timer. Existing score, slicing, audio and progression systems are unchanged. Menu and result copy has been shortened.

Validation: 64 unit tests and production build passed. Browser checks verified logo loading, separate countdown stages, mobile layout, slicing, life carryover, result/descent interruptions and audio cleanup with no page errors. Hardware tracking and speech accuracy remain unverified.

## Latest minimal UI update (supersedes earlier visual/countdown notes)

Countdown is now READY → GO!, one second each, preserving pause and tracking-loss behavior. Gameplay DOM text and Canvas lives/bonus labels have transparent backgrounds and bright lettering with a dark edge. The smaller supplied φruz mark has no individual background: it sits directly on the green bottom frame in gameplay and a matching full-height green strip at the left of the main menu, vertically centered. Menu button labels are centered independently of the level number. Existing mechanics and assets are retained.

Validation: 64 unit tests and production build pass. Desktop/mobile screenshots inspected; browser integration checks cover the two countdown stages, slicing, lives carryover, reveal/descent interruption and audio cleanup. Real camera/microphone accuracy remains unverified.

## Latest consistency fixes (supersedes earlier layout notes)

Every screen now uses the same solid green frame with equal responsive thickness on all four sides. The separate menu strip and thick bottom band are removed. Pause options again use sage boxes with a terracotta Resume button. The supplied φruz mark is a small bottom-left watermark inset 12px from the inside of the frame, without a background box. The extra corner Sushi Kiri logo has been removed from gameplay; the existing menu and secondary-screen brand remains.

Validation: 64 tests and production build passed. Browser integration checks cover equal border widths, watermark inset, restored pause-button fills, absence of the gameplay logo overlay, countdown, slicing and transition interruptions. Hardware recognition remains unverified.
