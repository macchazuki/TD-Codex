/** Pure effects for the Engineer's selectable perks. */

export const PERK_KEYS = Object.freeze({
  TOWER_UPGRADES: 'tower-upgrades',
  GOLD_INTEREST: 'gold-interest'
});

export const GOLD_INTEREST_RATE = 0.1;

/** Returns whether a loadout contains a specific perk. */
export function hasPerk(perkKeys, perkKey) {
  return Array.isArray(perkKeys) && perkKeys.includes(perkKey);
}

/** Calculates the end-of-round interest earned by a loadout. */
export function calculateInterest({gold, perkKeys, rate = GOLD_INTEREST_RATE}) {
  if (!hasPerk(perkKeys, PERK_KEYS.GOLD_INTEREST)) return 0;
  if (!Number.isFinite(gold) || !Number.isFinite(rate) || rate < 0) return 0;
  return Math.floor(gold * rate);
}
