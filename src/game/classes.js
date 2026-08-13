/** Available pre-game classes and perk-selection rules. */

export const MAX_SELECTED_PERKS = 5;

export const GAME_CLASSES = Object.freeze([
  Object.freeze({key: 'engineer', name: 'The Engineer', description: 'A systems specialist who fortifies the sector with advanced technology.'}),
  Object.freeze({key: 'mage', name: 'The Mage', description: 'An arcane specialist who channels elemental tower skills.'})
]);

export const ENGINEER_PERKS = Object.freeze([
  Object.freeze({key: 'tower-upgrades', name: 'Tower Upgrades', description: 'Allows towers to be upgraded.'}),
  Object.freeze({key: 'gold-interest', name: 'Gold Interest', description: 'Grants interest on gold when a round ends.'})
]);

export const MAGE_PERKS = Object.freeze([
  Object.freeze({key: 'arcane-focus', name: 'Arcane Focus', description: 'Basic attacks deal +15% damage, but skills deal -10% damage.'}),
  Object.freeze({key: 'elemental-mastery', name: 'Elemental Mastery', description: 'Skills deal +15% damage, but basic attacks deal -10% damage.'})
]);

export const CLASS_PERKS = Object.freeze({engineer: ENGINEER_PERKS, mage: MAGE_PERKS});
export const CLASS_STARTING_TOWERS = Object.freeze({engineer: ['filter', 'purge', 'daemon'], mage: ['fireball', 'lightning', 'frost']});

/** Returns the available class for a key, or null when the key is unknown. */
export function getGameClass(classKey) {
  return GAME_CLASSES.find((gameClass) => gameClass.key === classKey) || null;
}

/** Returns the available perk for a key, or null when the key is unknown. */
export function getEngineerPerk(perkKey) {
  return ENGINEER_PERKS.find((perk) => perk.key === perkKey) || null;
}

/** Returns the perks available to a class. */
export function getPerksForClass(classKey) {
  return CLASS_PERKS[classKey] || [];
}

/** Returns one class's starting tower keys. */
export function getStartingTowerKeys(classKey) {
  return [...(CLASS_STARTING_TOWERS[classKey] || [])];
}

/** Returns a class-specific perk definition by key. */
export function getPerkForClass(classKey, perkKey) {
  return getPerksForClass(classKey).find((perk) => perk.key === perkKey) || null;
}

/** Validates a class and perk selection without mutating the input. */
export function validateSelection({classKey, perkKeys}) {
  if (!getGameClass(classKey)) return {ok: false, reason: 'unknown-class'};
  if (!Array.isArray(perkKeys) || perkKeys.some((key) => !getPerkForClass(classKey, key))) {
    return {ok: false, reason: 'unknown-perk'};
  }
  if (new Set(perkKeys).size !== perkKeys.length) return {ok: false, reason: 'duplicate-perk'};
  if (perkKeys.length > MAX_SELECTED_PERKS) return {ok: false, reason: 'perk-limit'};
  return {ok: true};
}

/** Toggles a perk key while enforcing the maximum selection count. */
export function togglePerk(perkKeys, perkKey) {
  const available = [...ENGINEER_PERKS, ...MAGE_PERKS];
  if (!available.some((perk) => perk.key === perkKey)) return {ok: false, reason: 'unknown-perk', perkKeys: [...perkKeys]};
  if (perkKeys.includes(perkKey)) return {ok: true, perkKeys: perkKeys.filter((key) => key !== perkKey)};
  if (perkKeys.length >= MAX_SELECTED_PERKS) return {ok: false, reason: 'perk-limit', perkKeys: [...perkKeys]};
  return {ok: true, perkKeys: [...perkKeys, perkKey]};
}
