/** Shared game-speed values and simulation delta scaling helpers. */
export const GAME_SPEEDS = Object.freeze([0.5, 1, 2]);
export const DEFAULT_GAME_SPEED = 1;

/** Return whether a value is one of the supported game speeds. */
export function isSupportedGameSpeed(speed) {
  return GAME_SPEEDS.includes(speed);
}

/** Scale a real-time frame delta by the selected simulation speed. */
export function scaleDelta(delta, speed) {
  return delta * speed;
}
