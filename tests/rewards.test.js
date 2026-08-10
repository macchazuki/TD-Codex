import { describe, expect, it } from 'vitest';
import { addRewardToInventory, drawRewards, inventoryCount, removeFromInventory } from '../src/game/rewards.js';

describe('rewards', () => {
  it('draws a distinct, deterministic selection from a reward pool', () => {
    const pool = [{key: 'a'}, {key: 'b'}, {key: 'c'}, {key: 'd'}];

    expect(drawRewards(pool, 3, () => 0)).toEqual([{key: 'b'}, {key: 'c'}, {key: 'd'}]);
  });

  it('limits a selection to the available pool', () => {
    expect(drawRewards([{key: 'a'}], 3, () => 0)).toEqual([{key: 'a'}]);
  });

  it('adds generic rewards to typed inventory buckets', () => {
    const inventory = {};
    addRewardToInventory(inventory, {type: 'tower', key: 'filter'});
    addRewardToInventory(inventory, {type: 'tower', key: 'filter'});
    addRewardToInventory(inventory, {type: 'gold', key: 'small'});

    expect(inventoryCount(inventory, 'tower', 'filter')).toBe(2);
    expect(inventoryCount(inventory, 'gold', 'small')).toBe(1);
  });

  it('removes one inventory copy only when available', () => {
    const inventory = {tower: {filter: 1}};

    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(true);
    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(false);
    expect(inventoryCount(inventory, 'tower', 'filter')).toBe(0);
  });
});
