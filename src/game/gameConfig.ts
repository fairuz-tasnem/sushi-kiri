/**
 * Gameplay tuning values for Sushi Kiri, all in one place.
 *
 * Spawning and flight (sushi.ts, sushiSpawner.ts) and scoring (scoring.ts) read their numbers
 * from here. Constants that only affect how an object LOOKS (size, spin) stay in sushi.ts.
 *
 * Units, the same as the rest of the game:
 *   - distances are CSS pixels on the canvas, or a FRACTION of the canvas size where the
 *     name says so, so the game looks the same in a small window and a big one
 *   - speeds are per second, times are in seconds
 *   - positions use (0, 0) = top-left of the canvas, y grows downward
 *
 * These are starting values to be tuned by playing, not final numbers.
 */

export interface GameConfig {
  /* ---------- Spawning ---------- */

  /** Seconds after the Playing screen opens before the first sushi is launched. */
  firstSpawnDelaySeconds: number
  /** Seconds between two launches, picked at random from this range each time. */
  spawnIntervalSeconds: { min: number; max: number }
  /** The most objects allowed on screen at once. At the limit a launch is skipped, not queued. */
  maxObjectsOnScreen: number
  /**
   * Chance (0 to 1) that a launch is a soy sauce bottle instead of a sushi. Only rolled when
   * fewer than maxSoySauceOnScreen bottles are on screen, so bottles stay rare.
   */
  soySauceSpawnChance: number
  /** The most soy sauce bottles on screen at once. */
  maxSoySauceOnScreen: number
  /**
   * Chance (0 to 1) that a launch is a wasabi instead of a sushi, rolled the same way as the
   * soy sauce chance (one roll per launch, so the two chances do not interfere), and only while
   * fewer than maxWasabiOnScreen wasabi are on screen.
   */
  wasabiSpawnChance: number
  /** The most wasabi on screen at once. */
  maxWasabiOnScreen: number

  /* ---------- Velocity and gravity ---------- */

  /*
   * A sushi's initial velocity is set by the next two ranges. Upward speed is worked out from
   * how high the flight should peak (apexFromTop) and sideways speed is given directly
   * (horizontalSpeedWidths), so a launch looks the same whatever the window size.
   */

  /**
   * How high a launch peaks, as a fraction of the canvas height measured from the top
   * (0.25 = a quarter of the way down). Each object picks a value in this range, and its
   * launch speed is worked out from it, so a bigger window does not make objects too slow.
   */
  apexFromTop: { min: number; max: number }
  /** Sideways speed, in canvas widths per second; the direction (left or right) is random. */
  horizontalSpeedWidths: { min: number; max: number }
  /** Downward acceleration, in pixels per second squared per pixel of canvas height. */
  gravityPerHeight: number

  /* ---------- Object lifetime ---------- */

  /**
   * Safety net: an object still alive after this many seconds is removed even if it has
   * somehow not left the screen. Normally an object ends by falling out of the bottom edge.
   */
  maxObjectLifetimeSeconds: number
  /** How long the two halves of a cut object stay visible before being removed. */
  slicedPieceLifetimeSeconds: number

  /* ---------- Scoring, lives and power-ups ---------- */

  /** Points for cutting one sushi, before any multiplier. */
  pointsPerSushi: number
  /** Lives at the start of every new game. Cutting a wasabi costs exactly one. */
  startingLives: number
  /** How long the soy sauce bonus lasts. Cutting another bottle while it runs restarts this time. */
  soySauceDurationSeconds: number
  /** What a sushi's points are multiplied by while the soy sauce bonus is active (2 = double). */
  soySauceMultiplier: number
}

export const gameConfig: GameConfig = {
  firstSpawnDelaySeconds: 0.5,
  spawnIntervalSeconds: { min: 0.8, max: 1.6 },
  maxObjectsOnScreen: 5,
  soySauceSpawnChance: 0.15,
  maxSoySauceOnScreen: 1,
  wasabiSpawnChance: 0.2,
  maxWasabiOnScreen: 1,

  // Gravity is the Day 3A test sushi's value; the peak height varies around its old 0.25.
  apexFromTop: { min: 0.2, max: 0.4 },
  horizontalSpeedWidths: { min: 0.05, max: 0.2 },
  gravityPerHeight: 1.1,

  maxObjectLifetimeSeconds: 6,
  slicedPieceLifetimeSeconds: 0.6,

  pointsPerSushi: 10,
  startingLives: 3,
  soySauceDurationSeconds: 5,
  soySauceMultiplier: 2,
}
