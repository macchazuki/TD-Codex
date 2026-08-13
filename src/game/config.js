export const GRID_W = 12;
export const GRID_H = 8;
export const CELL = 2;
export const MAX_WAVE = 10;

export const TOWER_TYPES = {
  filter: {key: 'filter', name: 'Packet Filter', damage: 8, range: 4.2, fireRate: 2.5, splash: 0, color: 0x00e5ff, shape: 'diamond', desc: 'Fast, low-yield suppression node.'},
  purge: {key: 'purge', name: 'Purge Cannon', damage: 24, range: 3.6, fireRate: 0.9, splash: 1.5, color: 0xff9500, shape: 'circle', desc: 'Blast radius vs clustered intrusions.'},
  daemon: {key: 'daemon', name: 'Snipe Daemon', damage: 60, range: 7.2, fireRate: 0.55, splash: 0, color: 0xd926ff, shape: 'triangle', desc: 'Long-range precision strike node.'},
  fireball: {key: 'fireball', name: 'Fireball', damage: 12, range: 5.4, fireRate: 1.15, splash: 0, color: 0xff6b35, shape: 'star', desc: 'Elemental projectile with a burning skill.', skill: {cooldown: 8, damage: 18, splash: 1.6, burnDamage: 4, burnDuration: 3}},
  lightning: {key: 'lightning', name: 'Lightning', damage: 9, range: 5.8, fireRate: 1.25, splash: 0, color: 0xfff04a, shape: 'cross', desc: 'A chaining bolt that strikes nearby intrusions.', skill: {cooldown: 10, hits: 10}},
  frost: {key: 'frost', name: 'Frost', damage: 10, range: 5.1, fireRate: 0.9, splash: 0, color: 0x75d9ff, shape: 'hex', desc: 'A chilling attack with a slowing skill.', slow: {amount: 0.15, duration: 2}, skill: {cooldown: 7, slowAmount: 0.45, radius: 2.4, duration: 3}}
};

export const ENEMY_TYPES = {
  worm: {name: 'Worm', hp: 40, speed: 2.1, gold: 8, dmg: 1, color: 0xff4d6d, size: 0.42, geo: 'oct'},
  ping: {name: 'Ping Flood', hp: 22, speed: 3.7, gold: 10, dmg: 1, color: 0xff8fa3, size: 0.34, geo: 'tet'},
  trojan: {name: 'Trojan', hp: 160, speed: 1.25, gold: 26, dmg: 3, color: 0x8a1538, size: 0.55, geo: 'box'}
};

export const WAYPOINTS = [
  {x: -1, y: 1}, {x: 2, y: 1}, {x: 2, y: 5}, {x: 5, y: 5},
  {x: 5, y: 2}, {x: 9, y: 2}, {x: 9, y: 6}, {x: GRID_W, y: 6}
];
