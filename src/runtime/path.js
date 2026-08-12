import * as THREE from 'three';

/** Converts a grid coordinate into a centered world coordinate. */
export function gridToWorld(gx, gy, gridWidth, gridHeight, cellSize) {
  return new THREE.Vector3((gx - (gridWidth - 1) / 2) * cellSize, 0, (gy - (gridHeight - 1) / 2) * cellSize);
}

/** Calculates segment lengths for a Three.js route. */
export function getRouteMetrics(route) {
  const lengths = [];
  let total = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const length = route[index].distanceTo(route[index + 1]);
    lengths.push(length);
    total += length;
  }
  return {lengths, total};
}

/** Returns a point at a distance along a Three.js route. */
export function getPointOnRoute(route, lengths, totalLength, distance) {
  const clampedDistance = Math.max(0, Math.min(distance, totalLength));
  let accumulated = 0;
  for (let index = 0; index < lengths.length; index += 1) {
    if (clampedDistance <= accumulated + lengths[index] || index === lengths.length - 1) {
      const ratio = lengths[index] > 0
        ? Math.min(Math.max((clampedDistance - accumulated) / lengths[index], 0), 1)
        : 0;
      return new THREE.Vector3().lerpVectors(route[index], route[index + 1], ratio);
    }
    accumulated += lengths[index];
  }
  return route[route.length - 1].clone();
}
