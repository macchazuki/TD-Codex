/** Pure combat helpers for Mage tower skills and status effects. */

/** Returns the nearest eligible enemies, optionally allowing revisits. */
export function selectChainTargets({origin, enemies, range, limit, visited = new Set(), allowVisited = false, distance}) {
  const candidates = enemies.filter((enemy) => enemy.alive && (allowVisited || !visited.has(enemy)) && distance(origin, enemy) <= range);
  return candidates.sort((left, right) => distance(origin, left) - distance(origin, right)).slice(0, limit);
}

/** Returns the maximum distance between successive chain targets. */
export function getChainRange(attackRange) {
  return attackRange * 0.5;
}

/** Adds or refreshes a timed slow status without disturbing other statuses. */
export function applySlow(enemy, amount, duration) {
  enemy.slowStatuses = enemy.slowStatuses || [];
  enemy.slowStatuses.push({amount, remaining: duration});
  return enemy;
}

/** Advances slow statuses and returns the combined movement multiplier. */
export function tickSlow(enemy, delta) {
  enemy.slowStatuses = (enemy.slowStatuses || []).map((status) => ({...status, remaining: status.remaining - delta})).filter((status) => status.remaining > 0);
  return Math.max(0, 1 - (enemy.slowStatuses.reduce((total, status) => total + status.amount, 0)));
}

/** Adds a burn status that deals damage over its duration. */
export function applyBurn(enemy, damage, duration) {
  enemy.burnStatuses = enemy.burnStatuses || [];
  enemy.burnStatuses.push({damage, remaining: duration, elapsed: 0});
  return enemy;
}

/** Ticks burns and returns damage events for the caller to apply. */
export function tickBurn(enemy, delta) {
  const damageEvents = [];
  enemy.burnStatuses = (enemy.burnStatuses || []).map((status) => {
    const next = {...status, remaining: status.remaining - delta, elapsed: status.elapsed + delta};
    if (next.elapsed >= 1) { damageEvents.push(next.damage); next.elapsed -= 1; }
    return next;
  }).filter((status) => status.remaining > 0);
  return damageEvents;
}

/** Returns whether a tower's skill can be activated. */
export function isSkillReady(tower) {
  return Boolean(tower.cfg.skill && tower.skillCooldown <= 0);
}

/** Activates a skill cooldown and reports the configured duration. */
export function activateSkill(tower) {
  if (!isSkillReady(tower)) return false;
  tower.skillCooldown = tower.cfg.skill.cooldown;
  return true;
}

/** Returns whether an automatic skill cast has an eligible enemy to affect. */
export function canAutoCastSkill(tower, enemies, distance) {
  if (!isSkillReady(tower)) return false;
  if (tower.key === 'frost') {
    return enemies.some((enemy) => enemy.alive && distance(tower.group.position, enemy.mesh.position) <= tower.cfg.skill.radius);
  }
  return Boolean(tower.target?.alive);
}
