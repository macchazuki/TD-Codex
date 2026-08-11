import { describe, expect, it } from 'vitest';
import { addRewardToInventory, createRewardPool, drawRewards, removeFromInventory } from '../src/game/rewards.js';
import { SPECIAL_TILE_TYPES } from '../src/game/specialTiles.js';

describe('rewards', () => {
  it('draws a distinct, deterministic selection from a reward pool', () => {
    const pool = [{key: 'a'}, {key: 'b'}, {key: 'c'}, {key: 'd'}];

    expect(drawRewards(pool, 3, () => 0)).toEqual([{key: 'b'}, {key: 'c'}, {key: 'd'}]);
  });

  it('limits a selection to the available pool', () => {
    expect(drawRewards([{key: 'a'}], 3, () => 0)).toEqual([{key: 'a'}]);
  });

  it('adds each reward as a separate inventory item', () => {
    const inventory = [];
    addRewardToInventory(inventory, {type: 'tower', key: 'filter'});
    addRewardToInventory(inventory, {type: 'tower', key: 'filter'});

    expect(inventory).toHaveLength(2);
    expect(inventory[0]).not.toBe(inventory[1]);
  });

  it('removes one inventory copy only when available', () => {
    const inventory = [{type: 'tower', key: 'filter'}, {type: 'tower', key: 'filter'}];

    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(true);
    expect(inventory).toHaveLength(1);
    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(true);
    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(false);
    expect(inventory).toHaveLength(0);
  });

  it('supports tile rewards in the mixed pool and inventory', () => {
    const pool = createRewardPool({filter: {key: 'filter', name: 'Filter', desc: 'Fast', color: 1, shape: 'diamond', damage: 8, range: 4, fireRate: 2, splash: 0}}, SPECIAL_TILE_TYPES);
    expect(pool.some((item) => item.type === 'tower' && item.key === 'filter')).toBe(true);
    expect(pool.some((item) => item.type === 'tile' && item.key === 'dot')).toBe(true);
    const inventory = [];
    addRewardToInventory(inventory, {type: 'tile', key: 'dot'});
    expect(removeFromInventory(inventory, 'tile', 'dot')).toBe(true);
  });
});
