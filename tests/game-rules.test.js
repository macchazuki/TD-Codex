import { describe, expect, it } from 'vitest';
import {
  canPlaceTower,
  canPlaceWall,
  canRemoveWall,
  canStartWave,
  cellKey,
  enemyHealth,
  findPath,
  generateWave,
} from '../src/game/rules.js';

describe('game rules', () => {
  it('creates the expected wave composition', () => {
    expect(generateWave(1)).toHaveLength(8);
    expect(generateWave(2).every((type) => type === 'worm')).toBe(true);
    expect(generateWave(5)).toContain('ping');
    expect(generateWave(5)).toContain('trojan');
  });

  it('validates free tower placement on walls', () => {
    expect(cellKey(2, 3)).toBe('2,3');
    expect(canPlaceTower({gx: 2, gy: 3, isWall: true, occupied: new Set(), typeKey: 'filter'})).toEqual({ok: true});
    expect(canPlaceTower({gx: 2, gy: 3, isWall: false, occupied: new Set(), typeKey: 'filter'}).reason).toBe('wall');
    expect(canPlaceTower({gx: 2, gy: 3, isWall: true, occupied: new Set(['2,3']), typeKey: 'filter'}).reason).toBe('occupied');
  });

  it('places and removes walls without currency', () => {
    const walls = new Set();
    const options = {gx: 2, gy: 3, walls, occupied: new Set(), gridW: 4, gridH: 4, start: {gx: 0, gy: 0}, end: {gx: 3, gy: 3}};
    expect(canPlaceWall(options)).toEqual({ok: true});
    expect(canPlaceWall({...options, walls: new Set(['2,3'])}).reason).toBe('wall-exists');
    expect(canRemoveWall({walls: new Set(['2,3']), occupied: new Set(), gx: 2, gy: 3})).toEqual({ok: true});
    expect(canRemoveWall({walls: new Set(['2,3']), occupied: new Set(['2,3']), gx: 2, gy: 3}).reason).toBe('tower-on-wall');
  });

  it('rejects a wall that seals the route', () => {
    const walls = new Set(['1,0', '0,1', '1,2', '2,1']);
    expect(findPath({gridW: 3, gridH: 3, start: {gx: 0, gy: 0}, end: {gx: 2, gy: 2}, blocked: walls})).toBeNull();
    expect(canPlaceWall({gx: 1, gy: 1, walls: new Set(['1,0', '0,1', '1,2', '2,1']), occupied: new Set(), gridW: 3, gridH: 3, start: {gx: 0, gy: 0}, end: {gx: 2, gy: 2}}).reason).toBe('no-route');
  });

  it('scales enemy health', () => {
    expect(enemyHealth('worm', 1)).toBe(40);
    expect(enemyHealth('worm', 5)).toBeCloseTo(65.6);
  });

  it('only starts an eligible wave', () => {
    expect(canStartWave({wave: 0, waveInProgress: false, gameOver: false})).toBe(true);
    expect(canStartWave({wave: 1, waveInProgress: true, gameOver: false})).toBe(false);
    expect(canStartWave({wave: 10, waveInProgress: false, gameOver: false})).toBe(false);
  });
});
