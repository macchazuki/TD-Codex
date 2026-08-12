import * as THREE from 'three';

/** Creates the Three.js scene, camera, renderer, and fixed lighting. */
export function createScene(canvas, gridWidth, gridHeight, cellSize) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060a14);
  scene.fog = new THREE.FogExp2(0x060a14, 0.012);
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  } catch (error) {
    canvas.dataset.renderStatus = 'error';
    canvas.setAttribute('aria-label', '3D renderer unavailable');
    console.error('CORE://DEFENSE could not initialize WebGL.', error);
    throw error;
  }
  canvas.dataset.renderStatus = 'ready';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.AmbientLight(0x223355, 0.75));
  const sun = new THREE.DirectionalLight(0xaeefff, 1.0);
  sun.position.set(14, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 16;
  sun.shadow.camera.bottom = -16;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  scene.add(sun);
  const gridHelper = new THREE.GridHelper(Math.max(gridWidth, gridHeight) * cellSize + 10, 30, 0x11304a, 0x0c1c30);
  gridHelper.position.y = -0.35;
  scene.add(gridHelper);
  return {scene, camera, renderer};
}
