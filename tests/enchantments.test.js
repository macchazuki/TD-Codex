import { describe, expect, it } from 'vitest';
import { ENCHANTMENT_TYPES, applyEnchantment, applyHitEnchantments, calculateBounty, createEnchantmentRewardPool, tickDotStacks } from '../src/game/enchantments.js';

describe('enchantments', () => {
  it('defines the three V1 effects and converts them to rewards', () => {
    expect(Object.keys(ENCHANTMENT_TYPES)).toEqual(['burn', 'poison', 'bounty']);
    expect(createEnchantmentRewardPool()).toHaveLength(3);
  });

  it('consumes one valid inventory copy and rejects invalid targets', () => {
    const tower = {enchantments: []};
    const inventory = [{type: 'enchantment', key: 'burn'}, {type: 'enchantment', key: 'burn'}];
    expect(applyEnchantment({tower: null, inventory, typeKey: 'burn'}).ok).toBe(false);
    expect(inventory).toHaveLength(2);
    expect(applyEnchantment({tower, inventory, typeKey: 'burn'})).toMatchObject({ok: true, stackCount: 1});
    expect(applyEnchantment({tower, inventory, typeKey: 'burn'})).toMatchObject({ok: true, stackCount: 2});
    expect(inventory).toHaveLength(0);
  });

  it('creates additive independent burn and poison stacks', () => {
    const tower = {enchantments: ['burn', 'burn', 'poison']};
    const enemy = {};
    applyHitEnchantments({tower, damage: 20, enemy});
    expect(enemy.dotStacks).toHaveLength(3);
    expect(tickDotStacks({enemy, dt: 1}).map((event) => event.damage)).toEqual([2, 2, 1]);
    expect(tickDotStacks({enemy, dt: 1})).toHaveLength(3);
  });

  it('attributes DoT kills and scales bounty additively', () => {
    const tower = {enchantments: ['bounty', 'bounty']};
    const enemy = {};
    applyHitEnchantments({tower: {enchantments: ['burn']}, damage: 10, enemy});
    expect(tickDotStacks({enemy, dt: 1})[0].sourceTower.enchantments).toContain('burn');
    expect(calculateBounty(8, tower)).toBe(16);
    expect(calculateBounty(8, null)).toBe(8);
  });
});
