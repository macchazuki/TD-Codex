/** Pure effects for the Engineer's selectable perks. */

export const PERK_KEYS = Object.freeze({
  TOWER_UPGRADES: 'tower-upgrades',
  GOLD_INTEREST: 'gold-interest'
});

export const GOLD_INTEREST_RATE = 0.1;
export const MAGE_DAMAGE_MODIFIERS = Object.freeze({
  ATTACK_DAMAGE_PERK: Object.freeze({attack: 0.15, skill: -0.1}),
  SKILL_DAMAGE_PERK: Object.freeze({attack: -0.1, skill: 0.15})
});

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

/** Returns additive attack and skill damage modifiers for a selected loadout. */
export function getDamageModifiers(perkKeys) {
  const modifiers = {attack: 0, skill: 0};
  if (hasPerk(perkKeys, 'arcane-focus')) {
    modifiers.attack += MAGE_DAMAGE_MODIFIERS.ATTACK_DAMAGE_PERK.attack;
    modifiers.skill += MAGE_DAMAGE_MODIFIERS.ATTACK_DAMAGE_PERK.skill;
  }
  if (hasPerk(perkKeys, 'elemental-mastery')) {
    modifiers.attack += MAGE_DAMAGE_MODIFIERS.SKILL_DAMAGE_PERK.attack;
    modifiers.skill += MAGE_DAMAGE_MODIFIERS.SKILL_DAMAGE_PERK.skill;
  }
  return {attack: Number(modifiers.attack.toFixed(4)), skill: Number(modifiers.skill.toFixed(4))};
}
