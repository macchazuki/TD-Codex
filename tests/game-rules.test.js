import { describe, expect, it } from 'vitest';
import { canPlaceTower, canStartWave, cellKey, enemyHealth, generateWave, towerRefund } from '../src/game/rules.js';

describe('game rules', () => {
  it('creates the expected wave composition', () => {
    expect(generateWave(1)).toHaveLength(8);
    expect(generateWave(2).every((type) => type === 'worm')).toBe(true);
    expect(generateWave(5)).toContain('ping');
    expect(generateWave(5)).toContain('trojan');
  });

  it('validates tower placement and costs', () => {
    expect(cellKey(2, 3)).toBe('2,3');
    expect(canPlaceTower({gx: 2, gy: 3, isPath: false, occupied: new Set(), gold: 150, typeKey: 'filter'}).ok).toBe(true);
    expect(canPlaceTower({gx: 2, gy: 3, isPath: true, occupied: new Set(), gold: 150, typeKey: 'filter'}).reason).toBe('path');
    expect(canPlaceTower({gx: 2, gy: 3, isPath: false, occupied: new Set(['2,3']), gold: 150, typeKey: 'filter'}).reason).toBe('occupied');
    expect(canPlaceTower({gx: 2, gy: 3, isPath: false, occupied: new Set(), gold: 10, typeKey: 'filter'}).reason).toBe('insufficient-gold');
  });

  it('scales enemy health and refunds 60 percent of tower cost', () => {
    expect(enemyHealth('worm', 1)).toBe(40);
    expect(enemyHealth('worm', 5)).toBeCloseTo(65.6);
    expect(towerRefund('purge')).toBe(66);
  });

  it('only starts an eligible wave', () => {
    expect(canStartWave({wave: 0, waveInProgress: false, gameOver: false})).toBe(true);
    expect(canStartWave({wave: 1, waveInProgress: true, gameOver: false})).toBe(false);
    expect(canStartWave({wave: 10, waveInProgress: false, gameOver: false})).toBe(false);
  });
});
