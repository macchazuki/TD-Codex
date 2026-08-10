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

  it('adds each reward as a separate inventory item', () => {
    const inventory = {tower: []};
    addRewardToInventory(inventory, {type: 'tower', key: 'filter'});
    addRewardToInventory(inventory, {type: 'tower', key: 'filter'});

    expect(inventoryCount(inventory, 'tower', 'filter')).toBe(2);
    expect(inventory.tower).toHaveLength(2);
    expect(inventory.tower[0]).not.toBe(inventory.tower[1]);
  });

  it('removes one inventory copy only when available', () => {
    const inventory = {tower: [{type: 'tower', key: 'filter'}, {type: 'tower', key: 'filter'}]};

    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(true);
    expect(inventoryCount(inventory, 'tower', 'filter')).toBe(1);
    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(true);
    expect(removeFromInventory(inventory, 'tower', 'filter')).toBe(false);
    expect(inventoryCount(inventory, 'tower', 'filter')).toBe(0);
  });
});
