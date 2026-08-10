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

export function canPlaceTower({gx, gy, isWall, occupied, inventory, typeKey}) {
  const tower = TOWER_TYPES[typeKey];
  if (!tower) return {ok: false, reason: 'unknown-type'};
  if ((inventory?.tower?.[typeKey] || 0) < 1) return {ok: false, reason: 'unavailable'};
  if (!isWall) return {ok: false, reason: 'wall'};
  if (occupied.has(cellKey(gx, gy))) return {ok: false, reason: 'occupied'};
  return {ok: true};
}

/** Finds a four-direction grid route between two cells. */
export function findPath({gridW, gridH, start, end, blocked}) {
  const startKey = cellKey(start.gx, start.gy);
  const endKey = cellKey(end.gx, end.gy);
  if (blocked.has(startKey) || blocked.has(endKey)) return null;
  const queue = [start];
  const previous = new Map([[startKey, null]]);
  const directions = [{gx: 1, gy: 0}, {gx: -1, gy: 0}, {gx: 0, gy: 1}, {gx: 0, gy: -1}];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentKey = cellKey(current.gx, current.gy);
    if (currentKey === endKey) {
      const route = [];
      let key = currentKey;
      while (key) {
        const [gx, gy] = key.split(',').map(Number);
        route.unshift({gx, gy});
        key = previous.get(key);
      }
      return route;
    }
    directions.forEach(({gx, gy}) => {
      const next = {gx: current.gx + gx, gy: current.gy + gy};
      const nextKey = cellKey(next.gx, next.gy);
      if (next.gx < 0 || next.gx >= gridW || next.gy < 0 || next.gy >= gridH || previous.has(nextKey) || blocked.has(nextKey)) return;
      previous.set(nextKey, currentKey);
      queue.push(next);
    });
  }
  return null;
}

/** Validates a free wall placement while preserving an enemy route. */
export function canPlaceWall({gx, gy, walls, occupied, gridW, gridH, start, end}) {
  const key = cellKey(gx, gy);
  if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return {ok: false, reason: 'out-of-bounds'};
  if (walls.has(key)) return {ok: false, reason: 'wall-exists'};
  if (occupied.has(key)) return {ok: false, reason: 'tower-on-cell'};
  const nextWalls = new Set(walls);
  nextWalls.add(key);
  if (!findPath({gridW, gridH, start, end, blocked: nextWalls})) return {ok: false, reason: 'no-route'};
  return {ok: true};
}

/** Validates wall removal without removing a tower occupying the wall. */
export function canRemoveWall({gx, gy, walls, occupied}) {
  const key = cellKey(gx, gy);
  if (!walls.has(key)) return {ok: false, reason: 'no-wall'};
  if (occupied.has(key)) return {ok: false, reason: 'tower-on-wall'};
  return {ok: true};
}

export function enemyHealth(typeKey, wave) {
  const enemy = ENEMY_TYPES[typeKey];
  if (!enemy || wave < 1) return 0;
  return enemy.hp * (1 + (wave - 1) * 0.16);
}

export function canStartWave({wave, waveInProgress, gameOver}) {
  return !waveInProgress && !gameOver && wave < MAX_WAVE;
}
