/** Reward drawing and inventory operations for wave rewards. */

/** Draws distinct rewards from a pool using an injectable random source. */
export function drawRewards(rewardPool, rewardCount, random = Math.random) {
  if (!Array.isArray(rewardPool) || rewardPool.length === 0) return [];
  if (!Number.isInteger(rewardCount) || rewardCount < 1) return [];

  const shuffled = [...rewardPool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, Math.min(rewardCount, shuffled.length));
}

/** Converts tower definitions into the generic reward shape. */
export function createTowerRewardPool(towerTypes) {
  return Object.values(towerTypes).map((tower) => ({
    type: 'tower',
    key: tower.key,
    name: tower.name,
    description: tower.desc,
    color: tower.color,
    shape: tower.shape,
    cost: tower.cost,
    damage: tower.damage,
    range: tower.range,
    fireRate: tower.fireRate
  }));
}

/** Adds one selected reward to its typed inventory bucket. */
export function addRewardToInventory(inventory, reward) {
  if (!reward || typeof reward.type !== 'string' || typeof reward.key !== 'string') {
    return inventory;
  }
  const bucket = inventory[reward.type] || {};
  bucket[reward.key] = (bucket[reward.key] || 0) + 1;
  inventory[reward.type] = bucket;
  return inventory;
}

/** Returns the number of copies of a reward in its typed inventory bucket. */
export function inventoryCount(inventory, rewardType, rewardKey) {
  return inventory[rewardType]?.[rewardKey] || 0;
}

/** Removes one tower copy from inventory when it is deployed. */
export function removeFromInventory(inventory, rewardType, rewardKey) {
  const count = inventoryCount(inventory, rewardType, rewardKey);
  if (count > 0) inventory[rewardType][rewardKey] = count - 1;
  return count > 0;
}
