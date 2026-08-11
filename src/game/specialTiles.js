/** Pure definitions and effect rules for underlying special grid tiles. */

export const SPECIAL_TILE_TYPES = {
  slow: {
    key: 'slow',
    type: 'tile',
    name: 'Drag Field',
    desc: 'Slows enemies by 25% while they occupy this cell.',
    color: 0x4f8cff,
    shape: 'hex',
    speedMultiplier: 0.75
  },
  dot: {
    key: 'dot',
    type: 'tile',
    name: 'Burn Grid',
    desc: 'Deals 3 damage every second to enemies on this cell.',
    color: 0xff4d6d,
    shape: 'cross',
    damage: 3,
    interval: 1
  },
  buff: {
    key: 'buff',
    type: 'tile',
    name: 'Overclock Grid',
    desc: 'Boosts tower damage and fire rate by 15% on this cell.',
    color: 0x38ff8a,
    shape: 'star',
    damageMultiplier: 1.15,
    fireRateMultiplier: 1.15
  }
};

export const INITIAL_TILES = [
  {type: 'tile', key: 'slow', gx: 2, gy: 1},
  {type: 'tile', key: 'dot', gx: 0, gy: 1},
  {type: 'tile', key: 'buff', gx: 3, gy: 3}
];

/** Returns the tile definition for a key, or null for an unknown key. */
export function getTileDefinition(typeKey) {
  return SPECIAL_TILE_TYPES[typeKey] || null;
}

/** Finds the one tile affecting a grid cell. */
export function getTileAt(tiles, gx, gy) {
  return tiles.find((tile) => tile.gx === gx && tile.gy === gy) || null;
}

/** Validates placing one non-stacking tile on a grid cell. */
export function canPlaceTile({gx, gy, gridW, gridH, occupied, tiles, inventory, typeKey}) {
  if (!getTileDefinition(typeKey)) return {ok: false, reason: 'unknown-type'};
  if (!inventory?.some((item) => item.type === 'tile' && item.key === typeKey)) return {ok: false, reason: 'unavailable'};
  if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return {ok: false, reason: 'out-of-bounds'};
  if (occupied.has(`${gx},${gy}`)) return {ok: false, reason: 'tower-on-cell'};
  if (getTileAt(tiles, gx, gy)) return {ok: false, reason: 'tile-exists'};
  return {ok: true};
}

/** Returns the active enemy effect for the tile on the enemy cell. */
export function getEnemyTileEffect(tile) {
  const definition = tile && getTileDefinition(tile.key);
  if (!definition) return {speedMultiplier: 1, dotDamage: 0, dotInterval: Infinity};
  return {
    speedMultiplier: definition.speedMultiplier || 1,
    dotDamage: definition.damage || 0,
    dotInterval: definition.interval || Infinity
  };
}

/** Calculates whether a DOT tick is due and returns the next timer value. */
export function applyDotTick({timer, dt, damage, interval}) {
  const nextTimer = timer + dt;
  if (!damage || !interval || nextTimer < interval) return {damage: 0, timer: nextTimer};
  return {damage, timer: nextTimer - interval};
}

/** Applies the active buff tile to a tower's base combat statistics. */
export function getEffectiveTowerStats(tower, tile) {
  const definition = tile && getTileDefinition(tile.key);
  const multiplier = definition?.key === 'buff' ? definition.damageMultiplier : 1;
  const fireRateMultiplier = definition?.key === 'buff' ? definition.fireRateMultiplier : 1;
  return {
    damage: tower.damage * multiplier,
    fireRate: tower.fireRate * fireRateMultiplier
  };
}
