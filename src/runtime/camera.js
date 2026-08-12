import * as THREE from 'three';

/** Creates the orbit camera controller used by pointer and touch input. */
export function createCameraController(camera) {
  const state = {
    azimuth: 0.55,
    elevation: 0.95,
    distance: 36,
    target: new THREE.Vector3(0, 0, 0)
  };
  const limits = {minDistance: 10, maxDistance: 55};

  function update() {
    camera.position.set(
      state.target.x + state.distance * Math.sin(state.azimuth) * Math.cos(state.elevation),
      state.target.y + state.distance * Math.sin(state.elevation),
      state.target.z + state.distance * Math.cos(state.azimuth) * Math.cos(state.elevation)
    );
    camera.lookAt(state.target);
  }

  return {state, limits, update};
}
