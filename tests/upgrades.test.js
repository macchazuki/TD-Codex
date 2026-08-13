import { describe, expect, it } from 'vitest';
import { getTowerStats, getUpgradeCost, purchaseTowerUpgrade } from '../src/game/upgrades.js';

const tower = {
  cfg: {damage: 10, range: 5, fireRate: 2},
  upgrades: {damage: 0, range: 0, fireRate: 0}
};

describe('tower upgrades', () => {
  it('calculates escalating costs independently for each stat', () => {
    expect(getUpgradeCost(tower, 'damage')).toBe(40);
    expect(getUpgradeCost({...tower, upgrades: {damage: 1}}, 'damage')).toBe(60);
    expect(getUpgradeCost({...tower, upgrades: {damage: 2}}, 'damage')).toBe(90);
    expect(getUpgradeCost(tower, 'range')).toBe(35);
  });

  it('applies percentage improvements from the base stats', () => {
    expect(getTowerStats(tower.cfg, {damage: 2, range: 1, fireRate: 3})).toEqual({
      damage: 14,
      range: 5.5,
      fireRate: 2.9
    });
  });

  it('purchases an upgrade and returns the updated balance and state', () => {
    const result = purchaseTowerUpgrade({tower, stat: 'damage', gold: 100, perkKeys: ['tower-upgrades']});

    expect(result).toEqual({
      ok: true,
      cost: 40,
      gold: 60,
      upgrades: {damage: 1, range: 0, fireRate: 0},
      stats: {damage: 12, range: 5, fireRate: 2}
    });
    expect(tower.upgrades.damage).toBe(0);
  });

  it('rejects unaffordable or unknown upgrades without changing state', () => {
    expect(purchaseTowerUpgrade({tower, stat: 'range', gold: 34, perkKeys: ['tower-upgrades']})).toEqual({
      ok: false,
      reason: 'insufficient-gold',
      cost: 35
    });
    expect(purchaseTowerUpgrade({tower, stat: 'splash', gold: 100, perkKeys: ['tower-upgrades']})).toEqual({
      ok: false,
      reason: 'unknown-stat'
    });
  });

  it('requires the tower-upgrades perk', () => {
    expect(purchaseTowerUpgrade({tower, stat: 'damage', gold: 100})).toEqual({
      ok: false,
      reason: 'perk-required'
    });
  });
});
