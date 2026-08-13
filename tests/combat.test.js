import {describe, expect, it} from 'vitest';
import {activateSkill, applyBurn, applySlow, getChainRange, isSkillReady, selectChainTargets, tickBurn, tickSlow} from '../src/game/combat.js';

const distance = (origin, enemy) => Math.abs(origin.x - enemy.x);

describe('Mage combat skills', () => {
  it('chains basic attacks through three unique targets', () => {
    const enemies = [0, 1, 2, 3].map((x) => ({x, alive: true}));
    const selected = selectChainTargets({origin: {x: 0}, enemies, range: 4, limit: 3, distance});
    expect(selected).toHaveLength(3);
    expect(new Set(selected).size).toBe(3);
  });

  it('uses half the attack range for successive chain jumps', () => {
    expect(getChainRange(5.8)).toBe(2.9);
  });

  it('allows ten-hit chains to revisit targets', () => {
    const enemies = [0, 1].map((x) => ({x, alive: true}));
    const hits = [];
    let origin = {x: 0};
    for (let index = 0; index < 10; index += 1) {
      const target = selectChainTargets({origin, enemies, range: 2, limit: 1, visited: new Set(hits), allowVisited: index >= enemies.length, distance})[0];
      hits.push(target);
      origin = target;
    }
    expect(hits).toHaveLength(10);
    expect(new Set(hits).size).toBe(2);
  });

  it('ticks burn damage and timed slow independently', () => {
    const enemy = {alive: true};
    applyBurn(enemy, 4, 3);
    applySlow(enemy, 0.45, 3);
    expect(tickBurn(enemy, 1)).toEqual([4]);
    expect(tickSlow(enemy, 1)).toBeCloseTo(0.55);
    expect(tickSlow(enemy, 2)).toBe(1);
  });

  it('uses configured cooldown readiness and activation reset', () => {
    const tower = {cfg: {skill: {cooldown: 8}}, skillCooldown: 0};
    expect(isSkillReady(tower)).toBe(true);
    expect(activateSkill(tower)).toBe(true);
    expect(tower.skillCooldown).toBe(8);
    expect(activateSkill(tower)).toBe(false);
  });
});
