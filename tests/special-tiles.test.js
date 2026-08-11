import { describe, expect, it } from 'vitest';
import {
  INITIAL_TILES,
  SPECIAL_TILE_TYPES,
  applyDotTick,
  canPlaceTile,
  getEffectiveTowerStats,
  getEnemyTileEffect,
  getTileAt
} from '../src/game/specialTiles.js';

describe('special tiles', () => {
  it('defines the deterministic starting layout and effects', () => {
    expect(INITIAL_TILES).toEqual([
      {type: 'tile', key: 'slow', gx: 2, gy: 1},
      {type: 'tile', key: 'dot', gx: 5, gy: 5},
      {type: 'tile', key: 'buff', gx: 3, gy: 3}
    ]);
    expect(SPECIAL_TILE_TYPES.slow.speedMultiplier).toBe(0.75);
    expect(SPECIAL_TILE_TYPES.dot).toMatchObject({damage: 3, interval: 1});
    expect(SPECIAL_TILE_TYPES.buff).toMatchObject({damageMultiplier: 1.15, fireRateMultiplier: 1.15});
  });

  it('validates inventory, bounds, towers, and non-stacking placement', () => {
    const options = {gx: 2, gy: 2, gridW: 4, gridH: 4, occupied: new Set(), tiles: [], inventory: [{type: 'tile', key: 'slow'}], typeKey: 'slow'};
    expect(canPlaceTile(options)).toEqual({ok: true});
    expect(canPlaceTile({...options, inventory: []}).reason).toBe('unavailable');
    expect(canPlaceTile({...options, occupied: new Set(['2,2'])}).reason).toBe('tower-on-cell');
    expect(canPlaceTile({...options, tiles: [{type: 'tile', key: 'dot', gx: 2, gy: 2}]}).reason).toBe('tile-exists');
    expect(canPlaceTile({...options, gx: 4}).reason).toBe('out-of-bounds');
  });

  it('looks up only the tile on the exact cell', () => {
    const tiles = [{type: 'tile', key: 'slow', gx: 2, gy: 1}];
    expect(getTileAt(tiles, 2, 1)).toEqual(tiles[0]);
    expect(getEnemyTileEffect(getTileAt(tiles, 2, 2))).toEqual({speedMultiplier: 1, dotDamage: 0, dotInterval: Infinity});
    expect(getEnemyTileEffect(tiles[0]).speedMultiplier).toBe(0.75);
  });

  it('ticks DOT on elapsed time without real clock waits', () => {
    expect(applyDotTick({timer: 0, dt: 0.9, damage: 3, interval: 1})).toEqual({damage: 0, timer: 0.9});
    expect(applyDotTick({timer: 0.9, dt: 0.2, damage: 3, interval: 1})).toMatchObject({damage: 3});
    expect(applyDotTick({timer: 0.9, dt: 0.2, damage: 3, interval: 1}).timer).toBeCloseTo(0.1);
  });

  it('modifies tower stats only on a buff tile', () => {
    const tower = {damage: 20, fireRate: 2};
    expect(getEffectiveTowerStats(tower, {key: 'buff'})).toEqual({damage: 23, fireRate: 2.3});
    expect(getEffectiveTowerStats(tower, {key: 'slow'})).toEqual({damage: 20, fireRate: 2});
  });
});
