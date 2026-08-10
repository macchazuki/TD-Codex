import { ENEMY_TYPES, MAX_WAVE, TOWER_TYPES } from './config.js';

export function cellKey(gx, gy) {
  return `${gx},${gy}`;
}

export function generateWave(wave) {
  const list = [];
  const count = 6 + wave * 2;
  for (let i = 0; i < count; i += 1) {
    if (wave >= 5 && i % 6 === 5) list.push('trojan');
    else if (wave >= 3 && i % 3 === 1) list.push('ping');
    else list.push('worm');
  }
  return list;
}

export function canPlaceTower({gx, gy, isPath, occupied, gold, typeKey}) {
  const tower = TOWER_TYPES[typeKey];
  if (!tower) return {ok: false, reason: 'unknown-type'};
  if (isPath) return {ok: false, reason: 'path'};
  if (occupied.has(cellKey(gx, gy))) return {ok: false, reason: 'occupied'};
  if (gold < tower.cost) return {ok: false, reason: 'insufficient-gold'};
  return {ok: true, cost: tower.cost};
}

export function towerRefund(typeKey) {
  const tower = TOWER_TYPES[typeKey];
  return tower ? Math.floor(tower.cost * 0.6) : 0;
}

export function enemyHealth(typeKey, wave) {
  const enemy = ENEMY_TYPES[typeKey];
  if (!enemy || wave < 1) return 0;
  return enemy.hp * (1 + (wave - 1) * 0.16);
}

export function canStartWave({wave, waveInProgress, gameOver}) {
  return !waveInProgress && !gameOver && wave < MAX_WAVE;
}
