import { hasPerk, PERK_KEYS } from './perks.js';

/** Pure rules for calculating and purchasing tower stat upgrades. */

export const UPGRADE_STATS = {
  damage: {label: 'DAMAGE', multiplier: 0.2, baseCost: 40},
  range: {label: 'RANGE', multiplier: 0.1, baseCost: 35},
  fireRate: {label: 'RATE', multiplier: 0.15, baseCost: 45}
};

const COST_MULTIPLIER = 1.5;

/** Returns a normalized upgrade-level record for a tower. */
export function getUpgradeLevels(tower = {}) {
  return {
    damage: tower.upgrades?.damage || 0,
    range: tower.upgrades?.range || 0,
    fireRate: tower.upgrades?.fireRate || 0
  };
}

/** Returns the next gold cost for a tower stat upgrade. */
export function getUpgradeCost(tower, stat) {
  const definition = UPGRADE_STATS[stat];
  if (!definition) return null;
  const level = getUpgradeLevels(tower)[stat];
  return Math.floor(definition.baseCost * COST_MULTIPLIER ** level);
}

/** Calculates a tower's current stats from its base definition and levels. */
export function getTowerStats(baseStats, upgrades = {}) {
  const levels = getUpgradeLevels({upgrades});
  return Object.fromEntries(Object.entries(UPGRADE_STATS).map(([stat, definition]) => [
    stat,
    baseStats[stat] * (1 + definition.multiplier * levels[stat])
  ]));
}

/** Calculates a purchase result without mutating the tower or gold balance. */
export function purchaseTowerUpgrade({tower, stat, gold, perkKeys = []}) {
  if (!hasPerk(perkKeys, PERK_KEYS.TOWER_UPGRADES)) return {ok: false, reason: 'perk-required'};
  const cost = getUpgradeCost(tower, stat);
  if (cost === null) return {ok: false, reason: 'unknown-stat'};
  if (!Number.isFinite(gold) || gold < cost) return {ok: false, reason: 'insufficient-gold', cost};

  const upgrades = getUpgradeLevels(tower);
  upgrades[stat] += 1;
  return {
    ok: true,
    cost,
    gold: gold - cost,
    upgrades,
    stats: getTowerStats(tower.cfg, upgrades)
  };
}
