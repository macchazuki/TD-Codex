import { describe, expect, it } from 'vitest';
import { DEFAULT_GAME_SPEED, GAME_SPEEDS, isSupportedGameSpeed, scaleDelta } from '../src/game/speed.js';

describe('game speed', () => {
  it('supports the three HUD speed values', () => {
    expect(GAME_SPEEDS).toEqual([0.5, 1, 2]);
    expect(GAME_SPEEDS.every(isSupportedGameSpeed)).toBe(true);
    expect(isSupportedGameSpeed(0.25)).toBe(false);
  });

  it('defaults to normal speed', () => {
    expect(DEFAULT_GAME_SPEED).toBe(1);
  });

  it('scales a frame delta by the selected speed', () => {
    expect(scaleDelta(0.04, 0.5)).toBe(0.02);
    expect(scaleDelta(0.04, 1)).toBe(0.04);
    expect(scaleDelta(0.04, 2)).toBe(0.08);
  });
});
