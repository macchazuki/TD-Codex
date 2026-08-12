/** Rules and typed data for permanent tower enchantments. */

export const ENCHANTMENT_TYPES = {
  burn: {
    key: 'burn', name: 'Burn', desc: '3 ticks over 3 seconds for 10% of hit damage.',
    color: 0xff5a36, shape: 'star', dot: {ticks: 3, interval: 1, damageRatio: 0.10}
  },
  poison: {
    key: 'poison', name: 'Poison', desc: '6 ticks over 6 seconds for 5% of hit damage.',
    color: 0x65d13f, shape: 'hex', dot: {ticks: 6, interval: 1, damageRatio: 0.05}
  },
  bounty: {
    key: 'bounty', name: 'Bounty', desc: 'Earn 50% more gold from this tower’s kills.',
    color: 0xffd43b, shape: 'diamond', bountyMultiplier: 1.5
  }
};

/** Converts an enchantment definition into an inventory/reward item. */
export function createEnchantmentReward(definition) {
  if (!definition?.key || !ENCHANTMENT_TYPES[definition.key]) return null;
  return {type: 'enchantment', key: definition.key, name: definition.name, description: definition.desc, color: definition.color, shape: definition.shape};
}

/** Creates the generic reward entries for every enchantment definition. */
export function createEnchantmentRewardPool(enchantmentTypes = ENCHANTMENT_TYPES) {
  return Object.values(enchantmentTypes).map(createEnchantmentReward).filter(Boolean);
}

/** Validates applying one inventory enchantment to a tower. */
export function canApplyEnchantment({tower, inventory, typeKey}) {
  if (!ENCHANTMENT_TYPES[typeKey]) return {ok: false, reason: 'unknown-enchantment'};
  if (!tower) return {ok: false, reason: 'not-a-tower'};
  if (!inventory?.some((item) => item.type === 'enchantment' && item.key === typeKey)) return {ok: false, reason: 'unavailable'};
  return {ok: true};
}

/** Applies one enchantment copy and returns the updated stack count. */
export function applyEnchantment({tower, inventory, typeKey}) {
  const validation = canApplyEnchantment({tower, inventory, typeKey});
  if (!validation.ok) return validation;
  const itemIndex = inventory.findIndex((item) => item.type === 'enchantment' && item.key === typeKey);
  inventory.splice(itemIndex, 1);
  tower.enchantments ??= [];
  tower.enchantments.push(typeKey);
  return {ok: true, stackCount: tower.enchantments.filter((key) => key === typeKey).length};
}

/** Creates an independent damage-over-time stack from one successful hit. */
export function createDotStack(typeKey, triggeringDamage, sourceTower) {
  const definition = ENCHANTMENT_TYPES[typeKey];
  if (!definition?.dot || !Number.isFinite(triggeringDamage) || triggeringDamage <= 0) return null;
  return {typeKey, damage: triggeringDamage * definition.dot.damageRatio, remainingTicks: definition.dot.ticks, timer: 0, sourceTower};
}

/** Applies all damage-over-time enchantment stacks carried by a tower. */
export function applyHitEnchantments({tower, damage, enemy}) {
  if (!tower?.enchantments || !enemy || !Number.isFinite(damage)) return [];
  enemy.dotStacks ??= [];
  const stacks = tower.enchantments.map((key) => createDotStack(key, damage, tower)).filter(Boolean);
  enemy.dotStacks.push(...stacks);
  return stacks;
}

/** Advances independent DoT stacks and returns tick damage/source events. */
export function tickDotStacks({enemy, dt}) {
  if (!enemy?.dotStacks || !Number.isFinite(dt) || dt <= 0) return [];
  const events = [];
  const remaining = [];
  enemy.dotStacks.forEach((stack) => {
    stack.timer += dt;
    const definition = ENCHANTMENT_TYPES[stack.typeKey];
    while (stack.timer >= definition.dot.interval && stack.remainingTicks > 0) {
      stack.timer -= definition.dot.interval;
      stack.remainingTicks -= 1;
      events.push({damage: stack.damage, sourceTower: stack.sourceTower, typeKey: stack.typeKey});
    }
    if (stack.remainingTicks > 0) remaining.push(stack);
  });
  enemy.dotStacks = remaining;
  return events;
}

/** Calculates kill gold using only the source tower’s bounty stacks. */
export function calculateBounty(baseGold, sourceTower) {
  const stacks = sourceTower?.enchantments?.filter((key) => key === 'bounty').length || 0;
  return baseGold * (1 + 0.5 * stacks);
}

