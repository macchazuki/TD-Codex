/** Available pre-game classes and perk-selection rules. */

export const MAX_SELECTED_PERKS = 5;

export const GAME_CLASSES = Object.freeze([
  Object.freeze({key: 'engineer', name: 'The Engineer', description: 'A systems specialist who fortifies the sector with advanced technology.'})
]);

export const ENGINEER_PERKS = Object.freeze([
  Object.freeze({key: 'tower-upgrades', name: 'Tower Upgrades', description: 'Allows towers to be upgraded.'}),
  Object.freeze({key: 'gold-interest', name: 'Gold Interest', description: 'Grants interest on gold when a round ends.'})
]);

/** Returns the available class for a key, or null when the key is unknown. */
export function getGameClass(classKey) {
  return GAME_CLASSES.find((gameClass) => gameClass.key === classKey) || null;
}

/** Returns the available perk for a key, or null when the key is unknown. */
export function getEngineerPerk(perkKey) {
  return ENGINEER_PERKS.find((perk) => perk.key === perkKey) || null;
}

/** Validates a class and perk selection without mutating the input. */
export function validateSelection({classKey, perkKeys}) {
  if (!getGameClass(classKey)) return {ok: false, reason: 'unknown-class'};
  if (!Array.isArray(perkKeys) || perkKeys.some((key) => !getEngineerPerk(key))) {
    return {ok: false, reason: 'unknown-perk'};
  }
  if (new Set(perkKeys).size !== perkKeys.length) return {ok: false, reason: 'duplicate-perk'};
  if (perkKeys.length > MAX_SELECTED_PERKS) return {ok: false, reason: 'perk-limit'};
  return {ok: true};
}

/** Toggles a perk key while enforcing the maximum selection count. */
export function togglePerk(perkKeys, perkKey) {
  if (!getEngineerPerk(perkKey)) return {ok: false, reason: 'unknown-perk', perkKeys: [...perkKeys]};
  if (perkKeys.includes(perkKey)) return {ok: true, perkKeys: perkKeys.filter((key) => key !== perkKey)};
  if (perkKeys.length >= MAX_SELECTED_PERKS) return {ok: false, reason: 'perk-limit', perkKeys: [...perkKeys]};
  return {ok: true, perkKeys: [...perkKeys, perkKey]};
}
