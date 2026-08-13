import {describe, expect, it} from 'vitest';
import {calculateInterest, getDamageModifiers, GOLD_INTEREST_RATE, hasPerk, PERK_KEYS} from '../src/game/perks.js';

describe('Engineer perks', () => {
  it('detects selected perks', () => {
    expect(hasPerk([PERK_KEYS.TOWER_UPGRADES], PERK_KEYS.TOWER_UPGRADES)).toBe(true);
    expect(hasPerk([], PERK_KEYS.GOLD_INTEREST)).toBe(false);
  });

  it('awards ten percent floored gold interest only when selected', () => {
    expect(calculateInterest({gold: 150, perkKeys: [PERK_KEYS.GOLD_INTEREST]})).toBe(15);
    expect(calculateInterest({gold: 159, perkKeys: [PERK_KEYS.GOLD_INTEREST]})).toBe(15);
    expect(calculateInterest({gold: 150, perkKeys: []})).toBe(0);
    expect(GOLD_INTEREST_RATE).toBe(0.1);
  });
});

describe('Mage damage perks', () => {
  it('applies the attack-focused percentage modifiers', () => {
    expect(getDamageModifiers(['arcane-focus'])).toEqual({attack: 0.15, skill: -0.1});
  });

  it('makes both Mage perks a net positive for both damage types', () => {
    expect(getDamageModifiers(['arcane-focus', 'elemental-mastery'])).toEqual({attack: 0.05, skill: 0.05});
  });
});
