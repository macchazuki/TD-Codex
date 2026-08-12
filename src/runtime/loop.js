import * as THREE from 'three';

/** Starts the render and simulation loop for the game scene. */
export function startGameLoop({gameSpeed, renderer, camera, scene, coreGroup, coreMesh, portal, updateCamera, updateSpawning, updateEnemies, updateTowers, updateProjectiles, updateEffects, updatePulses, isGameOver, isWaveInProgress, onElapsed}) {
  const clock = new THREE.Clock();
  let elapsed = 0;
  function animate() {
    requestAnimationFrame(animate);
    const realDelta = Math.min(clock.getDelta(), 0.05);
    const delta = gameSpeed() * realDelta;
    elapsed += delta;
    if (!isGameOver()) {
      if (isWaveInProgress()) updateSpawning(delta);
      updateEnemies(delta, elapsed);
      updateTowers(delta);
      updateProjectiles(delta);
    }
    updateEffects(delta);
    updatePulses(delta, elapsed);
    coreGroup.rotation.y += delta * 0.5;
    coreMesh.scale.setScalar(1 + Math.sin(elapsed * 2.4) * 0.06);
    portal.rotation.z += delta * 0.8;
    updateCamera();
    renderer.render(scene, camera);
    onElapsed(elapsed);
  }
  animate();
}
