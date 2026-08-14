import * as THREE from 'three';
import { CELL, ENEMY_TYPES, GRID_H, GRID_W, MAX_WAVE, TOWER_TYPES } from './game/config.js';
import { DEFAULT_GAME_SPEED, isSupportedGameSpeed, scaleDelta } from './game/speed.js';
import { canPlaceTower, canPlaceWall, canRemoveWall, canStartWave, cellKey, enemyHealth, findPath, generateWave } from './game/rules.js';
import { addRewardToInventory, createRewardPool, createStartingInventory, drawRewards, removeFromInventory, removeInventoryItem } from './game/rewards.js';
import { INITIAL_TILES, SPECIAL_TILE_TYPES, applyDotTick, canPlaceTile, getEffectiveTowerStats, getEnemyTileEffect, getTileAt } from './game/specialTiles.js';
import { getTowerStats, getUpgradeCost, purchaseTowerUpgrade, UPGRADE_STATS } from './game/upgrades.js';
import { ENCHANTMENT_TYPES, applyEnchantment, applyHitEnchantments, calculateBounty, tickDotStacks } from './game/enchantments.js';
import { createGameElements, getMenuElements } from './runtime/dom.js';
import { createScene } from './runtime/scene.js';
import { createGameState } from './runtime/state.js';
import { getPointOnRoute as getPointOnRouteFromPath, getRouteMetrics as getRouteMetricsFromPath, gridToWorld as gridToWorldFromPath } from './runtime/path.js';
import { createCameraController } from './runtime/camera.js';
import { startGameLoop } from './runtime/loop.js';
import { GAME_CLASSES, getGameClass, getPerksForClass, getStartingTowerKeys, togglePerk } from './game/classes.js';
import { applyBurn, applySlow, activateSkill, canAutoCastSkill, getChainRange, isSkillReady, selectChainTargets, tickBurn, tickSlow } from './game/combat.js';
import { calculateInterest, getDamageModifiers, hasPerk, PERK_KEYS } from './game/perks.js';
import { createSelectionElements } from './runtime/dom.js';

(function(){
  "use strict";

  const rewardPool = createRewardPool(TOWER_TYPES, SPECIAL_TILE_TYPES, ENCHANTMENT_TYPES);
  const state = createGameState({rewardPool, initialTiles: INITIAL_TILES, defaultGameSpeed: DEFAULT_GAME_SPEED, gridWidth: GRID_W, gridHeight: GRID_H});
  let {gold, lives, wave, waveInProgress, gameOver, awaitingReward, selectedTowerType, selectedTileType, selectedEnchantmentType, selectedTower, gameSpeed, wallEditMode, spawnQueue, spawnTimer, towers, enemies, projectiles, effects, pulses, inventory, tiles, currentRewards, occupiedSet, wallSet, pathSet, pathSetRoute, routeVersion, startCell, endCell, worldWaypoints, segmentLengths: segLengths, pathTotalLength} = state;
  const WALL_TOP = 0.78;
  const {canvas, mainMenu, startGameBtn} = getMenuElements();
  const selection = createSelectionElements();
  let gameStarted = false;
  let gameInitialized = false;
  let startupStage = 'main-menu';
  let selectedClassKey = null;
  let selectedPerkKeys = [];

  function showSelectionScreen(screen) {
    mainMenu.classList.add('hidden');
    selection.classSelection.classList.toggle('hidden', screen !== 'class-selection');
    selection.perkSelection.classList.toggle('hidden', screen !== 'perk-selection');
  }

  function renderClassCards() {
    selection.classCards.innerHTML = GAME_CLASSES.map((gameClass) => `
      <button class="selection-card class-card${selectedClassKey === gameClass.key ? ' selected' : ''}" data-class-key="${gameClass.key}" type="button" aria-pressed="${selectedClassKey === gameClass.key}">
        <span class="selection-card-label">CLASS</span><strong>${gameClass.name}</strong><span>${gameClass.description}</span>
      </button>`).join('');
    selection.classCards.querySelectorAll('[data-class-key]').forEach((card) => card.addEventListener('click', () => {
      selectedClassKey = card.dataset.classKey;
      renderClassCards();
      selection.classContinueBtn.disabled = !selectedClassKey;
    }));
  }

  function renderPerkCards() {
    selection.perkCards.innerHTML = getPerksForClass(selectedClassKey).map((perk) => {
      const isSelected = selectedPerkKeys.includes(perk.key);
      return `<button class="selection-card perk-card${isSelected ? ' selected' : ''}" data-perk-key="${perk.key}" type="button" aria-pressed="${isSelected}"><span class="selection-card-label">PERK</span><strong>${perk.name}</strong><span>${perk.description}</span><small>${isSelected ? 'ACTIVE' : 'NOT SELECTED'}</small></button>`;
    }).join('');
    selection.perkSelectionStatus.textContent = `${selectedPerkKeys.length} / 5 SELECTED`;
    selection.perkCards.querySelectorAll('[data-perk-key]').forEach((card) => card.addEventListener('click', () => {
      const result = togglePerk(selectedPerkKeys, card.dataset.perkKey);
      if (result.ok) {
        selectedPerkKeys = result.perkKeys;
        renderPerkCards();
      }
    }));
  }

  function openClassSelection() {
    startupStage = 'class-selection';
    renderClassCards();
    selection.classContinueBtn.disabled = !selectedClassKey;
    showSelectionScreen('class-selection');
  }

  function openPerkSelection() {
    startupStage = 'perk-selection';
    renderPerkCards();
    showSelectionScreen('perk-selection');
  }

  function startGame(){
    if(gameInitialized) return;
    openClassSelection();
  }

  function deployGame(){
    if (!getGameClass(selectedClassKey)) return;
    if (gameInitialized) {
      gameStarted = true;
      startupStage = 'deployed';
      selection.classSelection.classList.add('hidden');
      selection.perkSelection.classList.add('hidden');
      canvas.classList.remove('hidden');
      return;
    }
    gameInitialized = true;
    gameStarted = true;
    startupStage = 'deployed';
    selection.classSelection.classList.add('hidden');
    selection.perkSelection.classList.add('hidden');
    canvas.classList.remove('hidden');
    initializeGame();
  }

  function initializeGame(){
  const elements = createGameElements();
  inventory = createStartingInventory(rewardPool, getStartingTowerKeys(selectedClassKey));
  const {scene, camera, renderer} = createScene(canvas, GRID_W, GRID_H, CELL);
  elements.activeClassName.textContent = getGameClass(selectedClassKey).name;
  elements.activePerks.textContent = selectedPerkKeys.length ? selectedPerkKeys.map((key) => getPerksForClass(selectedClassKey).find((perk) => perk.key === key).name).join(' · ') : 'No active perks';

  // camera orbit
  const cameraController = createCameraController(camera);
  const {target: camTarget} = cameraController.state;
  const {minDistance: CAMERA_DISTANCE_MIN, maxDistance: CAMERA_DISTANCE_MAX} = cameraController.limits;
  let camDistance = cameraController.state.distance;
  const updateCamera = () => {
    cameraController.state.distance = camDistance;
    cameraController.update();
  };
  updateCamera();

  /* ---------------------------------------------------------------------
     GRID / PATH HELPERS
  --------------------------------------------------------------------- */
  function gridToWorld(gx, gy){
    return gridToWorldFromPath(gx, gy, GRID_W, GRID_H, CELL);
  }

  function buildPathMath(){
    worldWaypoints = [gridToWorld(-1, startCell.gy), ...pathSetRoute.map(cell => gridToWorld(cell.gx, cell.gy)), gridToWorld(GRID_W, endCell.gy)];
    segLengths = [];
    pathTotalLength = 0;
    for(let i=0;i<worldWaypoints.length-1;i++){
      const d = worldWaypoints[i].distanceTo(worldWaypoints[i+1]);
      segLengths.push(d);
      pathTotalLength += d;
    }
  }

  function getPointOnPath(dist){
    dist = Math.max(0, Math.min(dist, pathTotalLength));
    let acc = 0;
    for(let i=0;i<segLengths.length;i++){
      if(dist <= acc+segLengths[i] || i === segLengths.length-1){
        const t = segLengths[i] > 0 ? Math.min(Math.max((dist-acc)/segLengths[i],0),1) : 0;
        return new THREE.Vector3().lerpVectors(worldWaypoints[i], worldWaypoints[i+1], t);
      }
      acc += segLengths[i];
    }
    return worldWaypoints[worldWaypoints.length-1].clone();
  }

  function markPathCells(){
    pathSetRoute = findPath({gridW: GRID_W, gridH: GRID_H, start: startCell, end: endCell, blocked: wallSet}) || [];
    pathSet = new Set(pathSetRoute.map(({gx, gy}) => cellKey(gx, gy)));
  }

  function getPointOnRoute(route, lengths, totalLength, dist){
    return getPointOnRouteFromPath(route, lengths, totalLength, dist);
  }

  function getRouteMetrics(route){
    return getRouteMetricsFromPath(route);
  }

  function getGridCellFromWorld(position){
    return {
      gx: Math.min(GRID_W - 1, Math.max(0, Math.round(position.x / CELL + (GRID_W - 1) / 2))),
      gy: Math.min(GRID_H - 1, Math.max(0, Math.round(position.z / CELL + (GRID_H - 1) / 2)))
    };
  }

  function rebuildEnemyRoute(enemy){
    const currentPosition = new THREE.Vector3(enemy.mesh.position.x, 0, enemy.mesh.position.z);
    const currentCell = getGridCellFromWorld(currentPosition);
    const remainingCells = findPath({
      gridW: GRID_W,
      gridH: GRID_H,
      start: currentCell,
      end: endCell,
      blocked: wallSet
    });
    if(!remainingCells) return;
    const futurePoints = remainingCells
      .slice(1)
      .map(cell => gridToWorld(cell.gx, cell.gy));
    futurePoints.push(gridToWorld(GRID_W, endCell.gy));
    const route = [currentPosition, ...futurePoints];
    const metrics = getRouteMetrics(route);
    enemy.route = route;
    enemy.routeLengths = metrics.lengths;
    enemy.routeTotalLength = metrics.total;
    enemy.traveled = 0;
    enemy.routeVersion = routeVersion;
  }

  markPathCells();
  buildPathMath();

  /* ---------------------------------------------------------------------
     GROUND CELLS
  --------------------------------------------------------------------- */
  const groundGroup = new THREE.Group();
  scene.add(groundGroup);
  const wallGroup = new THREE.Group();
  scene.add(wallGroup);
  const tileGroup = new THREE.Group();
  scene.add(tileGroup);
  const cellMeshList = [];
  const cellMeshMap = {};
  const wallMeshMap = {};
  const tileMeshMap = {};

  const buildableMat = new THREE.MeshStandardMaterial({color:0x172743, emissive:0x07101e, emissiveIntensity:0.7, roughness:0.85, metalness:0.1});
  const buildableHoverOkMat = new THREE.MeshStandardMaterial({color:0x123322, emissive:0x0d5c2f, emissiveIntensity:0.6, roughness:0.7});
  const buildableHoverBadMat = new THREE.MeshStandardMaterial({color:0x331515, emissive:0x7a1020, emissiveIntensity:0.6, roughness:0.7});
  const pathMat = new THREE.MeshStandardMaterial({color:0x0d3042, emissive:0x005d74, emissiveIntensity:0.9, roughness:0.6});
  const occupiedMat = new THREE.MeshStandardMaterial({color:0x161f30, roughness:0.9});
  const wallMat = new THREE.MeshStandardMaterial({color:0xff9500, emissive:0x7a3c00, emissiveIntensity:0.8, roughness:0.55, metalness:0.5});

  const cellGeo = new THREE.BoxGeometry(CELL*0.9, 0.2, CELL*0.9);

  for(let gx=0; gx<GRID_W; gx++){
    for(let gy=0; gy<GRID_H; gy++){
      const key = gx+','+gy;
      const isPath = pathSet.has(key);
      const mesh = new THREE.Mesh(cellGeo, isPath ? pathMat.clone() : buildableMat.clone());
      const p = gridToWorld(gx,gy);
      mesh.position.set(p.x, 0.1, p.z);
      mesh.receiveShadow = true;
      mesh.userData = {gx, gy, isPath};
      groundGroup.add(mesh);
      cellMeshList.push(mesh);
      cellMeshMap[key] = mesh;
    }
  }

  function setCellVisual(gx,gy){
    const key = gx+','+gy;
    const mesh = cellMeshMap[key];
    if(!mesh) return;
    if(wallSet.has(key)){ mesh.material = occupiedMat; return; }
    if(pathSet.has(key)){ mesh.material = pathMat; return; }
    if(occupiedSet.has(key)){ mesh.material = occupiedMat; return; }
    mesh.material = buildableMat;
  }

  function refreshRoute(){
    markPathCells();
    buildPathMath();
    routeVersion += 1;
    enemies.forEach(enemy => {
      if(!enemy.alive) return;
      rebuildEnemyRoute(enemy);
    });
    cellMeshList.forEach(mesh => setCellVisual(mesh.userData.gx, mesh.userData.gy));
  }

  function placeWall(gx, gy){
    const key = cellKey(gx, gy);
    wallSet.add(key);
    const p = gridToWorld(gx, gy);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(CELL * 0.72, 0.65, CELL * 0.72), wallMat.clone());
    mesh.position.set(p.x, 0.42, p.z);
    mesh.castShadow = true;
    mesh.userData = {gx, gy};
    wallGroup.add(mesh);
    wallMeshMap[key] = mesh;
    if(getTileAt(tiles, gx, gy)) renderTile(getTileAt(tiles, gx, gy));
    refreshRoute();
  }

  function removeWall(gx, gy){
    const key = cellKey(gx, gy);
    const mesh = wallMeshMap[key];
    if(mesh) wallGroup.remove(mesh);
    delete wallMeshMap[key];
    wallSet.delete(key);
    if(getTileAt(tiles, gx, gy)) renderTile(getTileAt(tiles, gx, gy));
    refreshRoute();
  }

  function buildTileMesh(tile){
    const cfg = SPECIAL_TILE_TYPES[tile.key];
    const group = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({color: cfg.color, emissive: cfg.color, emissiveIntensity: 1.2, transparent: true, opacity: 0.82, roughness: 0.45, metalness: 0.25});
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.08, 6), material);
    base.position.y = 0.27;
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.43, 6), material.clone());
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.34;
    group.add(base, marker);
    const p = gridToWorld(tile.gx, tile.gy);
    group.position.set(p.x, wallSet.has(cellKey(tile.gx, tile.gy)) ? 0.5 : 0, p.z);
    group.userData.tileRef = tile;
    return group;
  }

  function renderTile(tile){
    const key = cellKey(tile.gx, tile.gy);
    if(tileMeshMap[key]) tileGroup.remove(tileMeshMap[key]);
    const mesh = buildTileMesh(tile);
    tileGroup.add(mesh);
    tileMeshMap[key] = mesh;
  }

  function renderAllTiles(){
    Object.values(tileMeshMap).forEach((mesh) => tileGroup.remove(mesh));
    Object.keys(tileMeshMap).forEach((key) => delete tileMeshMap[key]);
    tiles.forEach(renderTile);
  }

  renderAllTiles();

  /* ---------------------------------------------------------------------
     PATH GLOW STRIP + PULSES + DECOR
  --------------------------------------------------------------------- */
  const pulseGroup = new THREE.Group();
  scene.add(pulseGroup);
  const pulseGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const pulseMat = new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:1.6});
  const PULSE_COUNT = 8;
  for(let i=0;i<PULSE_COUNT;i++){
    const m = new THREE.Mesh(pulseGeo, pulseMat);
    m.userData.offset = (i/PULSE_COUNT) * pathTotalLength;
    pulseGroup.add(m);
  }
  function updatePulses(dt, t){
    pulseGroup.children.forEach(m=>{
      const dist = (m.userData.offset + t*3.2) % pathTotalLength;
      const p = getPointOnPath(dist);
      m.position.set(p.x, 0.28, p.z);
    });
  }

  // spawn portal (start)
  const portalGeo = new THREE.TorusGeometry(0.7, 0.09, 8, 24);
  const portalMat = new THREE.MeshStandardMaterial({color:0xff3b5c, emissive:0xff3b5c, emissiveIntensity:1.2});
  const portal = new THREE.Mesh(portalGeo, portalMat);
  const startPos = getPointOnPath(0);
  portal.position.set(startPos.x, 0.6, startPos.z);
  portal.rotation.x = Math.PI/2;
  scene.add(portal);

  // core (end)
  const coreGroup = new THREE.Group();
  const coreGeo = new THREE.IcosahedronGeometry(0.65, 0);
  const coreMat = new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:1.0, roughness:0.3, metalness:0.4});
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.castShadow = true;
  coreGroup.add(coreMesh);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 32), new THREE.MeshStandardMaterial({color:0x00e5ff, emissive:0x00e5ff, emissiveIntensity:0.8}));
  coreRing.rotation.x = Math.PI/2;
  coreGroup.add(coreRing);
  const endPos = getPointOnPath(pathTotalLength);
  coreGroup.position.set(endPos.x, 0.9, endPos.z);
  scene.add(coreGroup);

  /* ---------------------------------------------------------------------
     TOWER BUILDING
  --------------------------------------------------------------------- */
  const towersGroup = new THREE.Group();
  scene.add(towersGroup);

  function buildTowerMesh(cfg){
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({color:0x1a2740, roughness:0.6, metalness:0.4});
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.35, 10), baseMat);
    base.position.y = 0.175;
    base.castShadow = true; base.receiveShadow = true;
    group.add(base);

    const turret = new THREE.Group();
    turret.position.y = 0.42;
    const accentMat = new THREE.MeshStandardMaterial({color:cfg.color, emissive:cfg.color, emissiveIntensity:0.9, roughness:0.35, metalness:0.5});
    const darkMat = new THREE.MeshStandardMaterial({color:0x202c42, roughness:0.6, metalness:0.4});

    if(cfg.key === 'filter'){
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.4,0.32,0.4), darkMat);
      body.castShadow = true;
      turret.add(body);
      [-0.14, 0.14].forEach(off=>{
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045,0.045,0.55,8), accentMat);
        barrel.rotation.x = Math.PI/2;
        barrel.position.set(off, 0, 0.4);
        turret.add(barrel);
      });
    } else if(cfg.key === 'purge'){
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.36,10,10), darkMat);
      body.castShadow = true;
      turret.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.17,0.85,10), accentMat);
      barrel.rotation.x = Math.PI/2;
      barrel.position.set(0,0,0.55);
      turret.add(barrel);
    } else {
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.32,0.5,7), darkMat);
      body.rotation.x = Math.PI;
      body.position.y = 0.1;
      body.castShadow = true;
      turret.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.09,1.5,8), accentMat);
      barrel.rotation.x = Math.PI/2;
      barrel.position.set(0,0.1,0.85);
      turret.add(barrel);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34,0.03,6,20), accentMat);
      ring.rotation.x = Math.PI/2;
      ring.position.y = 0.05;
      turret.add(ring);
    }
    group.add(turret);
    group.userData.turret = turret;
    return group;
  }

  function makeRangeRing(range, color){
    const geo = new THREE.RingGeometry(range-0.05, range, 48);
    const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.28, side:THREE.DoubleSide});
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI/2;
    ring.position.y = 0.05;
    return ring;
  }

  function placeTower(gx, gy, typeKey, inventoryItem){
    const cfg = TOWER_TYPES[typeKey];
    const upgrades = {...(inventoryItem?.upgrades || {})};
    const stats = getTowerStats(cfg, upgrades);
    const group = buildTowerMesh(cfg);
    const p = gridToWorld(gx,gy);
    group.position.set(p.x, WALL_TOP, p.z);
    towersGroup.add(group);

    const tower = {
      key: typeKey, cfg, group, gx, gy,
      baseDamage: stats.damage, baseFireRate: stats.fireRate,
      damage: stats.damage, range: stats.range, fireRate: stats.fireRate, splash: cfg.splash,
      upgrades, enchantments: [...(inventoryItem?.enchantments || [])],
      cooldown: 0, target: null, kills: 0,
      rangeRing: null, skillCooldown: 0, skillLabel: null, autoCast: false
    };
    group.userData.towerRef = tower;
    towers.push(tower);
    createTowerSkillControl(tower);
    occupiedSet.add(gx+','+gy);
    setCellVisual(gx,gy);
    return tower;
  }

  function removeTower(tower){
    towersGroup.remove(tower.group);
    occupiedSet.delete(tower.gx+','+tower.gy);
    setCellVisual(tower.gx, tower.gy);
    towers = towers.filter(t => t !== tower);
    if(tower.rangeRing){ scene.remove(tower.rangeRing); }
    removeTowerSkillControl(tower);
    refreshTowerSkillLabels();
  }

  /* ---------------------------------------------------------------------
     PLACEMENT PREVIEW
  --------------------------------------------------------------------- */
  let previewMesh = null, previewRing = null, hoveredCellKey = null;
  function ensurePreview(cfg){
    if(previewMesh) return;
    previewMesh = buildTowerMesh(cfg);
    previewMesh.traverse(o=>{ if(o.material){ o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; }});
    scene.add(previewMesh);
    previewRing = makeRangeRing(cfg.range, cfg.color);
    scene.add(previewRing);
  }
  function ensureTilePreview(typeKey){
    if(previewMesh) return;
    previewMesh = buildTileMesh({type: 'tile', key: typeKey, gx: 0, gy: 0});
    previewMesh.traverse((object) => {
      if(object.material){ object.material = object.material.clone(); object.material.transparent = true; object.material.opacity = 0.55; }
    });
    scene.add(previewMesh);
  }
  function clearPreview(){
    if(previewMesh){ scene.remove(previewMesh); previewMesh = null; }
    if(previewRing){ scene.remove(previewRing); previewRing = null; }
    hoveredCellKey = null;
  }

  /* ---------------------------------------------------------------------
     ENEMIES
  --------------------------------------------------------------------- */
  const enemiesGroup = new THREE.Group();
  scene.add(enemiesGroup);

  function enemyGeometry(type){
    switch(type.geo){
      case 'oct': return new THREE.OctahedronGeometry(type.size, 0);
      case 'tet': return new THREE.TetrahedronGeometry(type.size, 0);
      case 'box': return new THREE.BoxGeometry(type.size*1.4, type.size*1.4, type.size*1.4);
      default: return new THREE.SphereGeometry(type.size, 8, 8);
    }
  }

  function spawnEnemy(typeKey, waveNum){
    const type = ENEMY_TYPES[typeKey];
    const hpMult = 1 + (waveNum-1)*0.16;
    const mesh = new THREE.Mesh(
      enemyGeometry(type),
      new THREE.MeshStandardMaterial({color:type.color, emissive:type.color, emissiveIntensity:0.5, roughness:0.4, metalness:0.2})
    );
    mesh.castShadow = true;
    const start = getPointOnPath(0);
    mesh.position.set(start.x, 0.5, start.z);
    enemiesGroup.add(mesh);

    // health bar
    const barGroup = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.7,0.09), new THREE.MeshBasicMaterial({color:0x220a12}));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.7,0.09), new THREE.MeshBasicMaterial({color:0x38ff8a}));
    fg.position.z = 0.001;
    barGroup.add(bg); barGroup.add(fg);
    barGroup.position.set(start.x, 1.05, start.z);
    scene.add(barGroup);

    const enemy = {
      typeKey, type, mesh, barGroup, fg,
      hp: enemyHealth(typeKey, waveNum), maxHp: enemyHealth(typeKey, waveNum),
      speed: type.speed, traveled: 0, alive: true, phase: Math.random()*10,
      dotTimer: 0, activeTile: null, activeTileEffect: {speedMultiplier: 1, dotDamage: 0},
      goldValue: type.gold, lifeDamage: type.dmg,
      dotStacks: [],
      slowStatuses: [], burnStatuses: [],
      route: worldWaypoints.map(point => point.clone()),
      routeLengths: segLengths.slice(), routeTotalLength: pathTotalLength, routeVersion
    };
    enemies.push(enemy);
    return enemy;
  }

  function removeEnemy(enemy){
    enemiesGroup.remove(enemy.mesh);
    scene.remove(enemy.barGroup);
    enemies = enemies.filter(e => e !== enemy);
  }

  /* ---------------------------------------------------------------------
     PROJECTILES & EFFECTS
  --------------------------------------------------------------------- */
  const projGroup = new THREE.Group();
  scene.add(projGroup);

  function fireProjectile(tower){
    if (tower.key === 'lightning') {
      fireLightningAttack(tower);
      return;
    }
    const cfg = tower.cfg;
    const mat = new THREE.MeshStandardMaterial({color:cfg.color, emissive:cfg.color, emissiveIntensity:2.0});
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), mat);
    const p = tower.group.position;
    mesh.position.set(p.x, 0.85, p.z);
    projGroup.add(mesh);
    projectiles.push({
      mesh, target: tower.target, damage: tower.damage, splash: tower.splash,
      speed: 16, sourceTower: tower
    });
  }

  function spawnEffect(pos, color){
    const geo = new THREE.RingGeometry(0.05, 0.16, 20);
    const mat = new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.9, side:THREE.DoubleSide});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.35, pos.z);
    mesh.rotation.x = -Math.PI/2;
    scene.add(mesh);
    effects.push({mesh, life: 0.35, maxLife: 0.35});
  }

  function damageEnemy(enemy, dmg, sourceTower){
    if(!enemy.alive) return;
    enemy.hp -= dmg;
    if(enemy.hp <= 0 && enemy.alive){
      enemy.alive = false;
      gold += calculateBounty(enemy.goldValue, sourceTower);
      updateGoldUI();
      if(sourceTower) sourceTower.kills++;
      spawnEffect(enemy.mesh.position, 0xffffff);
    }
  }

  /* ---------------------------------------------------------------------
     WAVES
  --------------------------------------------------------------------- */
  function startWave(){
    if(awaitingReward || !canStartWave({wave, waveInProgress, gameOver})) return;
    wave++;
    waveInProgress = true;
    spawnQueue = generateWave(wave);
    spawnTimer = 0;
    updateWaveUI();
    refreshWaveButton();
  }

  function updateSpawning(dt){
    if(spawnQueue.length === 0) return;
    spawnTimer -= dt;
    if(spawnTimer <= 0){
      spawnEnemy(spawnQueue.shift(), wave);
      spawnTimer = Math.max(0.32, 0.75 - wave*0.02);
    }
  }

  function checkWaveComplete(){
    if(waveInProgress && !gameOver && spawnQueue.length===0 && enemies.length===0){
      waveInProgress = false;
      towers.forEach((tower) => {
        if (tower.cfg.skill) tower.skillCooldown = 0;
      });
      refreshTowerSkillLabels();
      const interest = calculateInterest({gold, perkKeys: selectedPerkKeys});
      if(interest > 0){
        gold += interest;
        updateGoldUI();
        showMessage(`INTEREST +${interest} GOLD`);
      }
      presentWaveReward();
    }
  }

  function fireSkillProjectile(tower, target, damage, splash, skill) {
    const mat = new THREE.MeshStandardMaterial({color: tower.cfg.color, emissive: tower.cfg.color, emissiveIntensity: 2.4});
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat);
    mesh.position.set(tower.group.position.x, 0.85, tower.group.position.z);
    projGroup.add(mesh);
    projectiles.push({mesh, target, damage, splash, speed: 18, sourceTower: tower, burn: skill});
  }

  function activateTowerSkill(tower) {
    if (!activateSkill(tower)) return false;
    const cfg = tower.cfg;
    if (tower.key === 'fireball' && tower.target?.alive) {
      fireSkillProjectile(tower, tower.target, cfg.skill.damage * (1 + getDamageModifiers(selectedPerkKeys).skill), cfg.skill.splash, cfg.skill);
    } else if (tower.key === 'lightning') {
      const targets = buildLightningTargets(tower, cfg.skill.hits, true);
      fireLightningAttack(tower, cfg.skill.hits, targets, 1 + getDamageModifiers(selectedPerkKeys).skill);
    } else if (tower.key === 'frost') {
      enemies.forEach((enemy) => {
        if (enemy.alive && distXZ(tower.group.position, enemy.mesh.position) <= cfg.skill.radius) applySlow(enemy, cfg.skill.slowAmount, cfg.skill.duration);
      });
    }
    refreshTowerSkillLabels();
    return true;
  }

  /* ---------------------------------------------------------------------
     UPDATE LOOP FUNCTIONS
  --------------------------------------------------------------------- */
  function updateEnemies(dt, t){
    for(const enemy of enemies){
      if(!enemy.alive) continue;
      const cell = getGridCellFromWorld(enemy.mesh.position);
      const tile = getTileAt(tiles, cell.gx, cell.gy);
      const tileEffect = getEnemyTileEffect(tile);
      const slowMultiplier = tickSlow(enemy, dt);
      tickBurn(enemy, dt).forEach((damage) => damageEnemy(enemy, damage, null));
      enemy.activeTile = tile?.key || null;
      enemy.activeTileEffect = tileEffect;
      const enchantmentTicks = tickDotStacks({enemy, dt});
      enchantmentTicks.forEach((tick) => damageEnemy(enemy, tick.damage, tick.sourceTower));
      if(!enemy.alive) continue;
      enemy.traveled += enemy.speed * tileEffect.speedMultiplier * slowMultiplier * dt;
      const dotTick = applyDotTick({timer: enemy.dotTimer, dt, damage: tileEffect.dotDamage, interval: tileEffect.dotInterval});
      enemy.dotTimer = tileEffect.dotDamage ? dotTick.timer : 0;
      if(dotTick.damage) damageEnemy(enemy, dotTick.damage, null);
      if(!enemy.alive) continue;
      if(enemy.traveled >= enemy.routeTotalLength){
        lives -= enemy.lifeDamage;
        updateLivesUI();
        enemy.alive = false;
        enemy.reachedEnd = true;
        if(lives <= 0){ triggerLoss(); }
        continue;
      }
      const p = getPointOnRoute(enemy.route, enemy.routeLengths, enemy.routeTotalLength, enemy.traveled);
      const bob = Math.sin(t*4 + enemy.phase)*0.08;
      enemy.mesh.position.set(p.x, 0.5+bob, p.z);
      enemy.mesh.rotation.y += dt*1.6;
      enemy.mesh.rotation.x += dt*0.8;
      enemy.barGroup.position.set(p.x, 1.05+bob, p.z);
      enemy.barGroup.quaternion.copy(camera.quaternion);
      enemy.fg.scale.x = Math.max(0.001, enemy.hp/enemy.maxHp);
      enemy.fg.position.x = -(0.7 - 0.7*enemy.fg.scale.x)/2;
    }
    const dead = enemies.filter(e=>!e.alive);
    dead.forEach(removeEnemy);
    if(dead.length) checkWaveComplete();
  }

  function distXZ(a,b){
    const dx=a.x-b.x, dz=a.z-b.z;
    return Math.sqrt(dx*dx+dz*dz);
  }

  function updateTowers(dt){
    for(const tower of towers){
      refreshTowerStats(tower);
      tower.cooldown -= dt;
      tower.skillCooldown = Math.max(0, tower.skillCooldown - dt);
      if(!tower.target || !tower.target.alive || distXZ(tower.group.position, tower.target.mesh.position) > tower.range){
        tower.target = null;
        let best=null, bestDist=Infinity;
        for(const e of enemies){
          if(!e.alive) continue;
          const d = distXZ(tower.group.position, e.mesh.position);
          if(d <= tower.range && d < bestDist){ best=e; bestDist=d; }
        }
        tower.target = best;
      }
      if(tower.target){
        const dx = tower.target.mesh.position.x - tower.group.position.x;
        const dz = tower.target.mesh.position.z - tower.group.position.z;
        tower.group.userData.turret.rotation.y = Math.atan2(dx,dz);
        if(tower.cooldown <= 0){
          fireProjectile(tower);
          tower.cooldown = 1/tower.fireRate;
        }
      }
      if(tower.autoCast && canAutoCastSkill(tower, enemies, distXZ)) activateTowerSkill(tower);
      if(selectedTower === tower){
        tower.group.userData.turret.position.y = 0.42;
      }
    }
    refreshTowerSkillLabels();
  }

  function updateProjectiles(dt){
    const remaining = [];
    for(const proj of projectiles){
      if(!proj.target || !proj.target.alive){
        projGroup.remove(proj.mesh);
        continue;
      }
      const targetPos = proj.target.mesh.position;
      const dir = new THREE.Vector3().subVectors(targetPos, proj.mesh.position);
      const dist = dir.length();
      if(dist < 0.35){
        damageEnemy(proj.target, proj.damage, proj.sourceTower);
        applyHitEnchantments({tower: proj.sourceTower, damage: proj.damage, enemy: proj.target});
        if (proj.sourceTower.key === 'frost') applySlow(proj.target, proj.sourceTower.cfg.slow.amount, proj.sourceTower.cfg.slow.duration);
        if (proj.burn) applyBurn(proj.target, proj.burn.burnDamage, proj.burn.burnDuration);
        if(proj.splash > 0){
          for(const e of enemies){
            if(e === proj.target || !e.alive) continue;
            if(distXZ(e.mesh.position, targetPos) <= proj.splash){
              damageEnemy(e, proj.damage*0.6, proj.sourceTower);
              applyHitEnchantments({tower: proj.sourceTower, damage: proj.damage*0.6, enemy: e});
              if (proj.burn) applyBurn(e, proj.burn.burnDamage, proj.burn.burnDuration);
            }
          }
        }
        spawnEffect(targetPos, proj.mesh.material.color.getHex());
        projGroup.remove(proj.mesh);
        continue;
      }
      dir.normalize();
      proj.mesh.position.addScaledVector(dir, proj.speed*dt);
      remaining.push(proj);
    }
    projectiles = remaining;
  }

  function updateEffects(dt){
    const remaining = [];
    for(const fx of effects){
      fx.life -= dt;
      if(fx.life <= 0){ scene.remove(fx.mesh); continue; }
      if (fx.shouldScale !== false) {
        const s = 1 + (1-fx.life/fx.maxLife)*3;
        fx.mesh.scale.set(s,s,s);
      }
      fx.mesh.material.opacity = fx.life/fx.maxLife;
      remaining.push(fx);
    }
    effects = remaining;
  }

  /* ---------------------------------------------------------------------
     UI WIRING
  --------------------------------------------------------------------- */
  const {
    goldVal: goldValEl, livesVal: livesValEl, waveVal: waveValEl, waveBtn,
    speedButtons, wallModeButtons, nodeCards: nodeCardsEl, selectedPanel,
    towerDetails, tileTooltip, tileTooltipName, tileTooltipDescription,
    message: messageEl, rewardOverlay, rewardCards: rewardCardsEl, overlay,
    overlayTitle, overlaySubtitle, selName, selDmg, selRange, selRate,
    selKills, selEnchantments, autoCastSkillBtn, purgeBtn, upgradeActions, upgradeButtons, towerSkillControls
  } = elements;

  function projectWorldPosition(position) {
    const projected = position.clone().setY(WALL_TOP + 1.1).project(camera);
    const rect = canvas.getBoundingClientRect();
    return {x: rect.left + (projected.x + 1) * rect.width / 2, y: rect.top + (-projected.y + 1) * rect.height / 2};
  }

  const towerSkillControlsByTower = new Map();

  function createTowerSkillControl(tower) {
    if (!tower.cfg.skill || towerSkillControlsByTower.has(tower)) return;
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'tower-skill-control';
    control.dataset.towerKey = tower.key;
    control.setAttribute('aria-label', `Activate ${tower.cfg.name} skill`);
    control.title = `Activate ${tower.cfg.name} skill`;
    control.addEventListener('click', () => activateTowerSkill(tower));
    towerSkillControls.appendChild(control);
    towerSkillControlsByTower.set(tower, control);
    tower.skillLabel = control;
  }

  function removeTowerSkillControl(tower) {
    const control = towerSkillControlsByTower.get(tower);
    if (!control) return;
    control.remove();
    towerSkillControlsByTower.delete(tower);
    tower.skillLabel = null;
  }

  function refreshTowerSkillLabels() {
    towers.filter((tower) => tower.cfg.skill).forEach((tower) => {
      createTowerSkillControl(tower);
      const control = towerSkillControlsByTower.get(tower);
      const ready = isSkillReady(tower);
      const cooldown = tower.cfg.skill.cooldown;
      const cooldownProgress = Math.max(0, Math.min(1, 1 - tower.skillCooldown / cooldown));
      control.classList.toggle('ready', ready);
      control.disabled = !ready;
      control.style.setProperty('--cooldown-progress', String(cooldownProgress));
      control.title = ready ? `Activate ${tower.cfg.name} skill` : `${tower.cfg.name} skill cooldown: ${tower.skillCooldown.toFixed(1)} seconds`;
      const position = projectWorldPosition(tower.group.position);
      control.style.left = `${position.x}px`;
      control.style.top = `${position.y}px`;
    });
  }

  function buildLightningTargets(tower, limit, allowRevisits) {
    const targets = [];
    let origin = tower.group.position;
    const enemyDistance = (position, enemy) => distXZ(position, enemy.mesh.position);
    for (let index = 0; index < limit; index += 1) {
      const candidates = selectChainTargets({origin, enemies, range: index === 0 ? tower.range : getChainRange(tower.range), limit: 1, visited: new Set(targets), allowVisited: allowRevisits && index >= enemies.filter((enemy) => enemy.alive).length, distance: enemyDistance});
      if (!candidates.length) break;
      targets.push(candidates[0]);
      origin = candidates[0].mesh.position;
    }
    return targets;
  }

  function spawnLightningArc(from, to, color) {
    const start = new THREE.Vector3(from.x, 0.7, from.z);
    const end = new THREE.Vector3(to.x, 0.7, to.z);
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = Math.hypot(direction.x, direction.z);
    if (!Number.isFinite(length)) return;
    if (length < 0.001) {
      spawnEffect(start, color);
      return;
    }
    const perpendicular = new THREE.Vector3(-direction.z / length, 0, direction.x / length);
    const offset = Math.min(0.16, length * 0.2);
    const points = [start];
    for (let index = 1; index < 4; index += 1) {
      const point = start.clone().lerp(end, index / 4);
      point.addScaledVector(perpendicular, index % 2 ? offset : -offset);
      points.push(point);
    }
    points.push(end);
    const mesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({color, transparent: true, opacity: 1}));
    scene.add(mesh);
    effects.push({mesh, life: 0.18, maxLife: 0.18, shouldScale: false});
  }

  function fireLightningAttack(tower, maxHits = 3, targets = null, damageMultiplier = 1) {
    const hitTargets = [];
    let origin = tower.group.position;
    let target = tower.target?.alive ? tower.target : null;
    for (let index = 0; index < maxHits; index += 1) {
      if (targets) target = targets[index] || null;
      if (!target) {
        const candidates = selectChainTargets({
          origin,
          enemies,
          range: index === 0 ? tower.range : getChainRange(tower.range),
          limit: 1,
          visited: new Set(hitTargets),
          distance: (position, enemy) => distXZ(position, enemy.mesh.position)
        });
        target = candidates[0] || null;
      }
      if (!target?.alive) break;
      spawnLightningArc(origin, target.mesh.position, tower.cfg.color);
      damageEnemy(target, tower.damage * damageMultiplier, tower);
      applyHitEnchantments({tower, damage: tower.damage * damageMultiplier, enemy: target});
      hitTargets.push(target);
      origin = target.mesh.position;
      target = null;
    }
  }

  function updateGoldUI(){ goldValEl.textContent = Math.floor(gold); refreshNodeCards(); refreshSelectedTowerUI(); }
  function updateLivesUI(){ livesValEl.textContent = Math.max(0,Math.floor(lives)); }
  function updateWaveUI(){ waveValEl.textContent = wave; }
  function refreshSpeedButtons(){
    speedButtons.forEach((button) => {
      const isActive = Number(button.dataset.speed) === gameSpeed;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }
  function setGameSpeed(speed){
    if(!isSupportedGameSpeed(speed)) return false;
    gameSpeed = speed;
    refreshSpeedButtons();
    return true;
  }
  function refreshWallModeButtons(){
    wallModeButtons.forEach((button) => {
      const isActive = button.dataset.wallMode === wallEditMode;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }
  function setWallEditMode(mode){
    if(!['normal', 'build', 'remove'].includes(mode)) return false;
    wallEditMode = mode;
    resetWallEditing();
    refreshWallModeButtons();
    return true;
  }
  function clearInventorySelection(){
    selectedTowerType = null;
    selectedTileType = null;
    selectedEnchantmentType = null;
    clearPreview();
    refreshNodeCards();
  }
  function refreshWaveButton(){
    waveBtn.disabled = waveInProgress || awaitingReward || gameOver || wave>=MAX_WAVE;
    waveBtn.textContent = wave>=MAX_WAVE ? 'ALL WAVES CLEARED' : (awaitingReward ? 'SELECT REWARD' : (waveInProgress ? 'WAVE IN PROGRESS' : (wave===0 ? 'INITIATE WAVE' : 'NEXT WAVE')));
  }

  function iconShape(shape,color){
    const hex = '#' + color.toString(16).padStart(6,'0');
    if(shape==='diamond') return `<div style="width:100%;height:100%;background:${hex};transform:rotate(45deg) scale(0.7);box-shadow:0 0 8px ${hex};"></div>`;
    if(shape==='circle') return `<div style="width:100%;height:100%;border-radius:50%;background:${hex};box-shadow:0 0 8px ${hex};"></div>`;
    if(shape==='hex') return `<div style="width:100%;height:100%;background:${hex};clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0 50%);filter:drop-shadow(0 0 6px ${hex});"></div>`;
    if(shape==='cross') return `<div style="width:100%;height:100%;position:relative;filter:drop-shadow(0 0 6px ${hex});"><i style="position:absolute;left:42%;top:0;width:16%;height:100%;background:${hex};"></i><i style="position:absolute;left:0;top:42%;width:100%;height:16%;background:${hex};"></i></div>`;
    if(shape==='star') return `<div style="width:100%;height:100%;background:${hex};clip-path:polygon(50% 0,61% 36%,100% 36%,69% 58%,81% 100%,50% 74%,19% 100%,31% 58%,0 36%,39% 36%);filter:drop-shadow(0 0 6px ${hex});"></div>`;
    return `<div style="width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-bottom:19px solid ${hex};filter:drop-shadow(0 0 6px ${hex});"></div>`;
  }

  function buildNodeCards(){
    nodeCardsEl.innerHTML = '';
    inventory.forEach((item)=>{
      const cfg = item.type === 'tile' ? SPECIAL_TILE_TYPES[item.key] : item.type === 'enchantment' ? ENCHANTMENT_TYPES[item.key] : TOWER_TYPES[item.key];
      if(!cfg) return;
      const card = document.createElement('div');
      card.className = `node-card${item.type === 'tile' ? ' tile-card' : item.type === 'enchantment' ? ' enchantment-card' : ''}`;
      card.dataset.key = cfg.key;
      card.dataset.type = item.type;
      card.setAttribute('aria-label', `${cfg.name}, inventory item`);
      card.classList.toggle('active', item.type === 'tile' ? selectedTileType === cfg.key : item.type === 'enchantment' ? selectedEnchantmentType === cfg.key : selectedTowerType === cfg.key);
      card.innerHTML = `
        <div class="node-icon">${iconShape(cfg.shape, cfg.color)}</div>
        <div class="node-name">${cfg.name}</div>
        <div class="node-desc">${cfg.desc}</div>
      `;
      card.addEventListener('click', ()=>{
        if(gameOver || !inventory.some((inventoryItem) => inventoryItem.type === item.type && inventoryItem.key === cfg.key)) return;
        const isTile = item.type === 'tile';
        const isEnchantment = item.type === 'enchantment';
        const isSelected = isTile ? selectedTileType === cfg.key : isEnchantment ? selectedEnchantmentType === cfg.key : selectedTowerType === cfg.key;
        if(isSelected){
          selectedTowerType = null;
          selectedTileType = null;
          selectedEnchantmentType = null;
          clearPreview();
        } else {
          setWallEditMode('normal');
          selectedTowerType = isTile || item.type === 'enchantment' ? null : cfg.key;
          selectedTileType = isTile ? cfg.key : null;
          selectedEnchantmentType = isEnchantment ? cfg.key : null;
          deselectTower();
          clearPreview();
        }
        refreshNodeCards();
      });
      nodeCardsEl.appendChild(card);
    });
  }

  function refreshTowerStats(tower){
    const tile = getTileAt(tiles, tower.gx, tower.gy);
    const upgradedStats = getTowerStats(tower.cfg, tower.upgrades);
    const stats = getEffectiveTowerStats({damage: upgradedStats.damage, fireRate: upgradedStats.fireRate}, tile);
    tower.damage = stats.damage * (1 + getDamageModifiers(selectedPerkKeys).attack);
    tower.range = upgradedStats.range;
    tower.fireRate = stats.fireRate;
    tower.activeTile = tile?.key || null;
  }

  function placeTile(gx, gy, typeKey){
    const tile = {type: 'tile', key: typeKey, gx, gy};
    tiles.push(tile);
    renderTile(tile);
    setCellVisual(gx, gy);
  }
  function refreshNodeCards(){
    buildNodeCards();
  }
  buildNodeCards();

  let msgTimer = null;
  function showMessage(text){
    messageEl.textContent = text;
    messageEl.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(()=> messageEl.classList.remove('show'), 1400);
  }

  function buildRewardCards(){
    rewardCardsEl.innerHTML = '';
    currentRewards.forEach((reward)=>{
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'reward-card brackets';
      card.dataset.key = reward.key;
      card.dataset.type = reward.type;
      card.innerHTML = `
        <div class="node-icon">${iconShape(reward.shape, reward.color)}</div>
        <div class="node-name">${reward.name}</div>
        <div class="node-desc">${reward.description}</div>
        <div class="reward-stats"><span>${reward.type === 'tile' ? 'UTILITY TILE' : reward.type === 'enchantment' ? 'PERMANENT' : `DMG ${reward.damage}`}</span><span>${reward.type === 'tile' ? 'CONSUMABLE' : reward.type === 'enchantment' ? 'STACKABLE' : `RNG ${reward.range}`}</span></div>
      `;
      card.addEventListener('click', ()=> selectReward(reward));
      rewardCardsEl.appendChild(card);
    });
  }

  function presentWaveReward(){
    awaitingReward = true;
    currentRewards = drawRewards(rewardPool, 3);
    buildRewardCards();
    rewardOverlay.classList.remove('hidden');
    refreshWaveButton();
  }

  function selectReward(reward){
    addRewardToInventory(inventory, reward);
    awaitingReward = false;
    currentRewards = [];
    rewardCardsEl.innerHTML = '';
    rewardOverlay.classList.add('hidden');
    refreshNodeCards();
    if(wave >= MAX_WAVE) triggerWin();
    else {
      refreshWaveButton();
      showMessage(`${reward.name.toUpperCase()} ADDED TO INVENTORY`);
    }
  }

  function selectTower(tower){
    deselectTower();
    selectedTower = tower;
    selectedTowerType = null;
    selectedTileType = null;
    selectedEnchantmentType = null;
    clearPreview();
    refreshNodeCards();
    const ring = makeRangeRing(tower.range, tower.cfg.color);
    ring.position.x = tower.group.position.x;
    ring.position.y = WALL_TOP + 0.02;
    ring.position.z = tower.group.position.z;
    scene.add(ring);
    tower.rangeRing = ring;
    selectedPanel.classList.remove('hidden');
    refreshSelectedTowerUI();
  }
  function refreshSelectedTowerUI(){
    if(!selectedTower) return;
    autoCastSkillBtn.classList.toggle('hidden', !selectedTower.cfg.skill);
    autoCastSkillBtn.classList.toggle('active', selectedTower.autoCast);
    autoCastSkillBtn.setAttribute('aria-pressed', String(selectedTower.autoCast));
    autoCastSkillBtn.textContent = selectedTower.autoCast ? 'AUTO CAST: ON' : 'AUTO CAST: OFF';
    upgradeActions.classList.toggle('hidden', !hasPerk(selectedPerkKeys, PERK_KEYS.TOWER_UPGRADES));
    towerDetails.classList.remove('hidden');
    selName.textContent = selectedTower.cfg.name.toUpperCase();
    selDmg.textContent = selectedTower.damage.toFixed(1).replace('.0', '');
    selRange.textContent = selectedTower.range.toFixed(1);
    selRate.textContent = selectedTower.fireRate.toFixed(2)+'/s';
    selKills.textContent = selectedTower.kills;
    const enchantmentCounts = Object.keys(ENCHANTMENT_TYPES).map((key) => {
      const count = selectedTower.enchantments.filter((enchantment) => enchantment === key).length;
      return count ? `${ENCHANTMENT_TYPES[key].name} ×${count}` : null;
    }).filter(Boolean);
    selEnchantments.textContent = enchantmentCounts.join(', ') || 'NONE';
    Object.keys(UPGRADE_STATS).forEach((stat)=>{
      const cost = getUpgradeCost(selectedTower, stat);
      const controls = upgradeButtons[stat];
      controls.cost.textContent = `⬡ ${cost}`;
      controls.button.disabled = gameOver || !hasPerk(selectedPerkKeys, PERK_KEYS.TOWER_UPGRADES) || gold < cost;
    });
  }
  function deselectTower(){
    if(selectedTower && selectedTower.rangeRing){ scene.remove(selectedTower.rangeRing); selectedTower.rangeRing=null; }
    selectedTower = null;
    selectedPanel.classList.add('hidden');
  }
  autoCastSkillBtn.addEventListener('click', () => {
    if (!selectedTower?.cfg.skill) return;
    selectedTower.autoCast = !selectedTower.autoCast;
    refreshSelectedTowerUI();
  });
  Object.keys(UPGRADE_STATS).forEach((stat)=>{
    upgradeButtons[stat].button.addEventListener('click', ()=>{
      if(!selectedTower || !hasPerk(selectedPerkKeys, PERK_KEYS.TOWER_UPGRADES)) return;
      const result = purchaseTowerUpgrade({tower: selectedTower, stat, gold, perkKeys: selectedPerkKeys});
      if(!result.ok){
        showMessage(result.reason === 'insufficient-gold' ? 'INSUFFICIENT GOLD' : 'INVALID UPGRADE');
        return;
      }
      gold = result.gold;
      selectedTower.upgrades = result.upgrades;
      selectedTower.damage = result.stats.damage;
      selectedTower.range = result.stats.range;
      selectedTower.fireRate = result.stats.fireRate;
      if(selectedTower.rangeRing){
        scene.remove(selectedTower.rangeRing);
        selectedTower.rangeRing = makeRangeRing(selectedTower.range, selectedTower.cfg.color);
        selectedTower.rangeRing.position.set(selectedTower.group.position.x, WALL_TOP + 0.02, selectedTower.group.position.z);
        scene.add(selectedTower.rangeRing);
      }
      updateGoldUI();
      showMessage(`${UPGRADE_STATS[stat].label} UPGRADED`);
    });
  });
  purgeBtn.addEventListener('click', ()=>{
    if(!selectedTower) return;
    const reward = rewardPool.find((item) => item.key === selectedTower.key);
    addRewardToInventory(inventory, {...reward, upgrades: {...selectedTower.upgrades}, enchantments: [...selectedTower.enchantments]});
    removeTower(selectedTower);
    deselectTower();
    refreshNodeCards();
  });

  waveBtn.addEventListener('click', startWave);
  speedButtons.forEach((button) => {
    button.addEventListener('click', () => setGameSpeed(Number(button.dataset.speed)));
  });
  wallModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      clearInventorySelection();
      setWallEditMode(button.dataset.wallMode);
    });
  });
  refreshSpeedButtons();
  refreshWallModeButtons();
  refreshWaveButton();

  document.getElementById('restartBtn').addEventListener('click', resetGame);

  /* ---------------------------------------------------------------------
     INPUT / RAYCASTING
  --------------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();
  let wallEditAction = null, lastEditedCellKey = null;
  let touchEditStartCell = null;
  const activeTouchPointers = new Map();
  const touchGesture = {midpoint: null, distance: 0};
  const CAMERA_TARGET_MARGIN = CELL * 2;
  let mousePanPoint = null;
  setWallEditMode('build');

  function setMouseFromEvent(e){
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((e.clientX-rect.left)/rect.width)*2-1;
    mouseNDC.y = -((e.clientY-rect.top)/rect.height)*2+1;
  }

  canvas.addEventListener('contextmenu', e=> e.preventDefault());

  function getCellAtPointer(e){
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const cellHits = raycaster.intersectObjects(cellMeshList);
    return cellHits.length ? cellHits[0].object.userData : null;
  }

  function getTileAtPointer(e){
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const tileHits = raycaster.intersectObjects(tileGroup.children, true);
    if(!tileHits.length) return null;
    let object = tileHits[0].object;
    while(object && !object.userData.tileRef) object = object.parent;
    return object?.userData.tileRef || null;
  }

  function hideTileTooltip(){
    tileTooltip.classList.add('hidden');
  }

  function updateTileTooltip(e){
    const tile = getTileAtPointer(e);
    if(!tile){
      hideTileTooltip();
      return;
    }
    const definition = SPECIAL_TILE_TYPES[tile.key];
    if(!definition){
      hideTileTooltip();
      return;
    }
    tileTooltipName.textContent = definition.name.toUpperCase();
    tileTooltipDescription.textContent = definition.desc;
    tileTooltip.classList.remove('hidden');
    const appRect = document.getElementById('app').getBoundingClientRect();
    const left = Math.min(e.clientX - appRect.left + 14, appRect.width - tileTooltip.offsetWidth - 12);
    const top = Math.min(e.clientY - appRect.top + 14, appRect.height - tileTooltip.offsetHeight - 12);
    tileTooltip.style.left = `${Math.max(12, left)}px`;
    tileTooltip.style.top = `${Math.max(12, top)}px`;
  }

  function editWallCell(gx, gy, action){
    const key = cellKey(gx, gy);
    if(key === lastEditedCellKey) return;
    lastEditedCellKey = key;
    const wallOptions = {gx, gy, walls: wallSet, occupied: occupiedSet, gridW: GRID_W, gridH: GRID_H, start: startCell, end: endCell};
    if(action === 'remove'){
      if(!wallSet.has(key)) return;
      const removal = canRemoveWall(wallOptions);
      if(removal.ok) removeWall(gx, gy);
      return;
    }
    if(wallSet.has(key)) return;
    const placement = canPlaceWall(wallOptions);
    if(placement.ok) placeWall(gx, gy);
  }

  function resetWallEditing(){
    wallEditAction = null;
    lastEditedCellKey = null;
    touchEditStartCell = null;
  }

  function placeSelectedAtPointer(e){
    const cell = getCellAtPointer(e);
    if(!cell) return;
    const {gx, gy} = cell;
    const key = cellKey(gx, gy);
    const towerOnCell = towers.find(tower => cellKey(tower.gx, tower.gy) === key);
    if(towerOnCell){
      if(selectedEnchantmentType){
        const enchantmentKey = selectedEnchantmentType;
        const result = applyEnchantment({tower: towerOnCell, inventory, typeKey: enchantmentKey});
        if(result.ok){ selectedEnchantmentType = null; selectTower(towerOnCell); showMessage(`${ENCHANTMENT_TYPES[enchantmentKey].name.toUpperCase()} APPLIED`); }
        else showMessage(result.reason === 'unavailable' ? 'NO ENCHANTMENT IN INVENTORY' : 'INVALID TARGET');
      } else selectTower(towerOnCell);
      return;
    }
    const isTile = Boolean(selectedTileType);
    const isEnchantment = Boolean(selectedEnchantmentType);
    if(isEnchantment){ showMessage('SELECT A TOWER'); return; }
    const typeKey = isTile ? selectedTileType : selectedTowerType;
    const placement = isTile
      ? canPlaceTile({gx, gy, gridW: GRID_W, gridH: GRID_H, occupied: occupiedSet, tiles, inventory, typeKey})
      : canPlaceTower({gx, gy, isWall: wallSet.has(key), occupied: occupiedSet, inventory, typeKey});
    if(!placement.ok){
      const messages = {wall:'DEPLOY A WALL FIRST', occupied:'NODE SLOT OCCUPIED', 'tower-on-cell':'NODE SLOT OCCUPIED', unavailable:'NO ITEM IN INVENTORY', 'tile-exists':'CELL ALREADY HAS A TILE'};
      showMessage(messages[placement.reason] || 'INVALID NODE DEPLOYMENT');
      return;
    }
    if(isTile){
      placeTile(gx, gy, typeKey);
      removeFromInventory(inventory, 'tile', typeKey);
    } else {
      const inventoryItem = inventory.find((item) => item.type === 'tower' && item.key === selectedTowerType);
      placeTower(gx, gy, selectedTowerType, inventoryItem);
      removeInventoryItem(inventory, inventoryItem);
    }
    selectedTowerType = null;
    selectedTileType = null;
    selectedEnchantmentType = null;
    clearPreview();
    refreshNodeCards();
  }

  function handlePrimaryPointerDown(e, shouldDeferWallEdit = false){
    if(gameOver) return;
    const wallAction = wallEditMode === 'build' ? 'place' : wallEditMode === 'remove' ? 'remove' : null;
    if(wallAction){
      const cell = getCellAtPointer(e);
      if(cell){
        wallEditAction = wallAction;
        lastEditedCellKey = null;
        if(!shouldDeferWallEdit) editWallCell(cell.gx, cell.gy, wallEditAction);
      }
      return;
    }
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const towerHits = raycaster.intersectObjects(towersGroup.children, true);
    if(towerHits.length){
      let obj = towerHits[0].object;
      while(obj && !obj.userData.towerRef) obj = obj.parent;
      if(obj && obj.userData.towerRef){
        if(selectedEnchantmentType){
          const enchantmentKey = selectedEnchantmentType;
          const result = applyEnchantment({tower: obj.userData.towerRef, inventory, typeKey: enchantmentKey});
          if(result.ok){
            selectedEnchantmentType = null;
            selectTower(obj.userData.towerRef);
            showMessage(`${ENCHANTMENT_TYPES[enchantmentKey].name.toUpperCase()} APPLIED`);
          } else showMessage(result.reason === 'unavailable' ? 'NO ENCHANTMENT IN INVENTORY' : 'INVALID TARGET');
        } else selectTower(obj.userData.towerRef);
        return;
      }
    }
    if(selectedTowerType || selectedTileType || selectedEnchantmentType){
      if(selectedEnchantmentType && towerHits.length){
        let obj = towerHits[0].object;
        while(obj && !obj.userData.towerRef) obj = obj.parent;
        const result = applyEnchantment({tower: obj?.userData.towerRef, inventory, typeKey: selectedEnchantmentType});
        if(result.ok){
          const enchantmentKey = selectedEnchantmentType;
          selectedEnchantmentType = null;
          refreshNodeCards();
          refreshSelectedTowerUI();
          showMessage(`${ENCHANTMENT_TYPES[enchantmentKey].name.toUpperCase()} APPLIED`);
        } else showMessage(result.reason === 'unavailable' ? 'NO ENCHANTMENT IN INVENTORY' : 'SELECT A TOWER');
        return;
      }
      placeSelectedAtPointer(e);
      return;
    }
    const cell = getCellAtPointer(e);
    if(!cell){
      deselectTower();
      return;
    }
    const key = cellKey(cell.gx, cell.gy);
    const towerOnCell = towers.find(tower => cellKey(tower.gx, tower.gy) === key);
    if(towerOnCell){
      selectTower(towerOnCell);
      return;
    }
  }

  function clampCameraTarget(){
    const maxX = ((GRID_W - 1) / 2) * CELL + CAMERA_TARGET_MARGIN;
    const maxZ = ((GRID_H - 1) / 2) * CELL + CAMERA_TARGET_MARGIN;
    camTarget.x = THREE.MathUtils.clamp(camTarget.x, -maxX, maxX);
    camTarget.z = THREE.MathUtils.clamp(camTarget.z, -maxZ, maxZ);
  }

  function getBoardPoint(clientX, clientY){
    setMouseFromEvent({clientX, clientY});
    raycaster.setFromCamera(mouseNDC, camera);
    return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }

  function getTouchPair(){
    return [...activeTouchPointers.values()].slice(0, 2);
  }

  function initializeTouchGesture(){
    const [first, second] = getTouchPair();
    if(!first || !second) return;
    touchGesture.midpoint = {x: (first.x + second.x) / 2, y: (first.y + second.y) / 2};
    touchGesture.distance = Math.hypot(first.x - second.x, first.y - second.y);
  }

  function updateTouchCamera(){
    const [first, second] = getTouchPair();
    if(!first || !second || !touchGesture.midpoint) return;
    const midpoint = {x: (first.x + second.x) / 2, y: (first.y + second.y) / 2};
    const previousBoardPoint = getBoardPoint(touchGesture.midpoint.x, touchGesture.midpoint.y);
    const currentBoardPoint = getBoardPoint(midpoint.x, midpoint.y);
    if(previousBoardPoint && currentBoardPoint){
      camTarget.add(previousBoardPoint.sub(currentBoardPoint));
      clampCameraTarget();
    }
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    camDistance = THREE.MathUtils.clamp(camDistance - (distance - touchGesture.distance) * 0.04, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX);
    touchGesture.midpoint = midpoint;
    touchGesture.distance = distance;
  }

  function resetTouchGesture(){
    activeTouchPointers.clear();
    touchGesture.midpoint = null;
    touchGesture.distance = 0;
    resetWallEditing();
  }

  function resetTouchGestureBaseline(){
    touchGesture.midpoint = null;
    touchGesture.distance = 0;
  }

  function resetMousePanning(){
    mousePanPoint = null;
  }

  function updateMousePan(e){
    if(!mousePanPoint) return;
    const currentPoint = getBoardPoint(e.clientX, e.clientY);
    if(currentPoint){
      const previousPoint = getBoardPoint(mousePanPoint.x, mousePanPoint.y);
      if(previousPoint) camTarget.add(previousPoint.sub(currentPoint));
      clampCameraTarget();
    }
    mousePanPoint = {x: e.clientX, y: e.clientY};
  }

  function handleTouchPointerDown(e){
    e.preventDefault();
    if(e.isTrusted) canvas.setPointerCapture?.(e.pointerId);
    activeTouchPointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if(activeTouchPointers.size === 1){
      const cell = getCellAtPointer(e);
      handlePrimaryPointerDown(e, true);
      if(wallEditAction && cell) touchEditStartCell = cell;
      return;
    }
    resetWallEditing();
    if(activeTouchPointers.size === 2) initializeTouchGesture();
  }

  function handleTouchPointerMove(e){
    if(!activeTouchPointers.has(e.pointerId)) return;
    e.preventDefault();
    activeTouchPointers.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if(activeTouchPointers.size === 2){
      updateTouchCamera();
      return;
    }
    if(wallEditAction){
      if(touchEditStartCell){
        editWallCell(touchEditStartCell.gx, touchEditStartCell.gy, wallEditAction);
        touchEditStartCell = null;
      }
      const cell = getCellAtPointer(e);
      if(cell) editWallCell(cell.gx, cell.gy, wallEditAction);
    }
  }

  function handleTouchPointerEnd(e){
    if(!activeTouchPointers.has(e.pointerId)) return;
    e.preventDefault();
    if(activeTouchPointers.size === 1 && wallEditAction && e.type === 'pointerup'){
      if(touchEditStartCell){
        editWallCell(touchEditStartCell.gx, touchEditStartCell.gy, wallEditAction);
        touchEditStartCell = null;
      }
      const cell = getCellAtPointer(e);
      if(cell) editWallCell(cell.gx, cell.gy, wallEditAction);
    }
    activeTouchPointers.delete(e.pointerId);
    if(e.isTrusted && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if(activeTouchPointers.size >= 2){
      initializeTouchGesture();
      return;
    }
    resetTouchGestureBaseline();
    if(activeTouchPointers.size === 0) resetWallEditing();
  }

  canvas.addEventListener('pointerdown', (e)=>{
    if(e.pointerType === 'touch'){
      handleTouchPointerDown(e);
      return;
    }
    if(e.button === 2) return;
    if(e.button === 1){
      resetWallEditing();
      mousePanPoint = {x: e.clientX, y: e.clientY};
      return;
    }
    if(e.button !== 0 || gameOver) return;
    handlePrimaryPointerDown(e);
  });

  window.addEventListener('pointermove', (e)=>{
    if(e.pointerType === 'touch'){
      handleTouchPointerMove(e);
      return;
    }
    if(mousePanPoint){
      hideTileTooltip();
      updateMousePan(e);
      return;
    }
    if(wallEditAction){
      hideTileTooltip();
      const cell = getCellAtPointer(e);
      if(cell) editWallCell(cell.gx, cell.gy, wallEditAction);
      return;
    }
    updateTileTooltip(e);
    if(!selectedTowerType && !selectedTileType && !selectedEnchantmentType) return;
    setMouseFromEvent(e);
    raycaster.setFromCamera(mouseNDC, camera);
    const cellHits = raycaster.intersectObjects(cellMeshList);
    if(!cellHits.length){
      clearPreview();
      return;
    }
    if(cellHits.length){
      const {gx, gy} = cellHits[0].object.userData;
      const key = gx+','+gy;
      if(key !== hoveredCellKey){
        hoveredCellKey = key;
        const isTile = Boolean(selectedTileType);
        const isEnchantment = Boolean(selectedEnchantmentType);
        const typeKey = isTile ? selectedTileType : isEnchantment ? selectedEnchantmentType : selectedTowerType;
        const cfg = isTile ? SPECIAL_TILE_TYPES[typeKey] : isEnchantment ? ENCHANTMENT_TYPES[typeKey] : TOWER_TYPES[typeKey];
        const valid = isTile
          ? canPlaceTile({gx, gy, gridW: GRID_W, gridH: GRID_H, occupied: occupiedSet, tiles, inventory, typeKey}).ok
          : isEnchantment ? towers.some((tower) => cellKey(tower.gx, tower.gy) === key) : wallSet.has(key) && !occupiedSet.has(key);
        const p = gridToWorld(gx,gy);
        if(isTile) ensureTilePreview(typeKey);
        else if(!isEnchantment) ensurePreview(cfg);
        previewMesh.position.set(p.x, isTile ? 0 : WALL_TOP, p.z);
        if(previewRing) previewRing.position.set(p.x,WALL_TOP + 0.02,p.z);
        previewMesh.traverse(o=>{ if(o.material) o.material.opacity = valid?0.6:0.25; });
        if(previewRing) previewRing.material.color.set(valid ? cfg.color : 0xff3b5c);
      }
    }
  });
  canvas.addEventListener('pointerleave', hideTileTooltip);
  window.addEventListener('pointerup', (e)=>{
    if(e.pointerType === 'touch'){
      handleTouchPointerEnd(e);
      return;
    }
    resetMousePanning();
    resetWallEditing();
  });
  window.addEventListener('pointercancel', (e)=>{
    if(e.pointerType === 'touch') handleTouchPointerEnd(e);
    else resetMousePanning();
  });
  window.addEventListener('blur', ()=>{
    resetTouchGesture();
    resetMousePanning();
  });

  canvas.addEventListener('wheel', (e)=>{
    e.preventDefault();
    camDistance = Math.min(CAMERA_DISTANCE_MAX, Math.max(CAMERA_DISTANCE_MIN, camDistance + e.deltaY*0.02));
  }, {passive:false});

  window.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape'){
      selectedTowerType = null;
      selectedTileType = null;
      clearPreview();
      deselectTower();
      refreshNodeCards();
    }
  });

  window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    refreshTowerSkillLabels();
  });

  /* ---------------------------------------------------------------------
     GAME OVER / WIN / RESET
  --------------------------------------------------------------------- */
  function triggerLoss(){
    gameOver = true;
    overlayTitle.textContent = 'CORE BREACHED';
    overlayTitle.style.color = 'var(--danger)';
    overlaySubtitle.textContent = `The intrusion overwhelmed your defenses at wave ${wave}. Deploy again to re-secure the sector.`;
    overlay.classList.remove('hidden');
  }
  function triggerWin(){
    gameOver = true;
    overlayTitle.textContent = 'SECTOR SECURED';
    overlayTitle.style.color = 'var(--cyan)';
    overlaySubtitle.textContent = `All ${MAX_WAVE} intrusion waves neutralized. Core integrity held at ${Math.max(0,Math.floor(lives))}.`;
    overlay.classList.remove('hidden');
  }

  function resetGame(){
    towers.slice().forEach(removeTower);
    enemies.slice().forEach(removeEnemy);
    projectiles.forEach(p=>projGroup.remove(p.mesh));
    projectiles = [];
    effects.forEach(fx=>scene.remove(fx.mesh));
    effects = [];
    Object.values(wallMeshMap).forEach(mesh => wallGroup.remove(mesh));
    wallSet.clear();
    Object.keys(wallMeshMap).forEach(key => delete wallMeshMap[key]);
    refreshRoute();
    tiles = INITIAL_TILES.map((tile) => ({...tile}));
    renderAllTiles();
    gold = 150; lives = 20; wave = 0; waveInProgress = false; gameOver = false; awaitingReward = false;
    setGameSpeed(DEFAULT_GAME_SPEED);
    spawnQueue = []; spawnTimer = 0;
    inventory = createStartingInventory(rewardPool, getStartingTowerKeys(selectedClassKey || 'engineer'));
    currentRewards = [];
    setWallEditMode('normal');
    selectedTowerType = null; selectedTileType = null; selectedEnchantmentType = null; clearPreview(); deselectTower();
    updateGoldUI(); updateLivesUI(); updateWaveUI(); refreshWaveButton(); refreshNodeCards();
    rewardCardsEl.innerHTML = '';
    rewardOverlay.classList.add('hidden');
    overlay.classList.add('hidden');
    selectedClassKey = null;
    selectedPerkKeys = [];
    startupStage = 'class-selection';
    gameStarted = false;
    canvas.classList.add('hidden');
    renderClassCards();
    showSelectionScreen('class-selection');
  }

  // Lightweight inspection surface for browser tests and deployment
  // diagnostics. It exposes state only; gameplay still goes through the
  // same input handlers and rules as a normal player session.
  window.__CORE_DEFENSE__ = {
    getSceneState(){
      return {
        scene: gameStarted ? 'tower-defence-map' : startupStage,
        startupStage,
        selectedClass: selectedClassKey,
        selectedPerks: [...selectedPerkKeys],
        renderStatus: canvas.dataset.renderStatus || 'unknown',
        renderCalls: renderer.info.render.calls,
        gold: Math.floor(gold),
        mapCells: cellMeshList.length,
        walls: wallSet.size,
        routeCells: pathSetRoute.length,
        routeVersion,
        enemyRouteVersions: enemies.map(enemy => enemy.routeVersion),
        enemyPositions: enemies.map(enemy => [enemy.mesh.position.x, enemy.mesh.position.z]),
        enemyRouteStarts: enemies.map(enemy => [enemy.route[0].x, enemy.route[0].z]),
        towers: towers.length,
        tiles: tiles.map((tile) => ({...tile})),
        tileInventory: inventory.filter((item) => item.type === 'tile').map((item) => item.key),
        enchantmentInventory: inventory.filter((item) => item.type === 'enchantment').map((item) => item.key),
        enemyEffects: enemies.map((enemy) => ({activeTile: enemy.activeTile, speedMultiplier: enemy.activeTileEffect.speedMultiplier, dotDamage: enemy.activeTileEffect.dotDamage, dotTimer: enemy.dotTimer})),
        towerStats: towers.map((tower) => ({key: tower.key, gx: tower.gx, gy: tower.gy, damage: tower.damage, range: tower.range, fireRate: tower.fireRate, activeTile: tower.activeTile})),
        towerSkills: towers.filter((tower) => tower.cfg.skill).map((tower) => ({key: tower.key, cooldown: tower.skillCooldown, ready: isSkillReady(tower), autoCast: tower.autoCast})),
        activeStatuses: enemies.map((enemy) => ({slow: [...(enemy.slowStatuses || [])], burn: [...(enemy.burnStatuses || [])]})),
        towerUpgrades: towers.map((tower) => ({...tower.upgrades})),
        towerEnchantments: towers.map((tower) => [...tower.enchantments]),
        activeDotEffects: enemies.flatMap((enemy) => enemy.dotStacks.map((stack) => ({type: stack.typeKey, damage: stack.damage, remainingTicks: stack.remainingTicks}))),
        previewVisible: Boolean(previewMesh),
        wallEditAction,
        wallEditMode,
        cameraTarget: {x: camTarget.x, y: camTarget.y, z: camTarget.z},
        cameraDistance: camDistance,
        enemies: enemies.length,
        inventory: inventory.map((item) => item.key),
        startingInventory: getStartingTowerKeys(selectedClassKey || 'engineer'),
        inventoryItems: inventory.map((item) => ({type: item.type, key: item.key})),
        awaitingReward,
        rewardChoices: currentRewards.map((reward) => reward.key),
        gameSpeed,
        simulationElapsed: elapsed
      };
    },
    showWaveRewardForTest(){
      presentWaveReward();
    },
    completeWaveForTest(){
      waveInProgress = true;
      spawnQueue = [];
      enemies = [];
      checkWaveComplete();
    },
    grantRewardForTest(type, key){
      const reward = rewardPool.find((item) => item.type === type && item.key === key);
      if(reward) addRewardToInventory(inventory, reward);
      refreshNodeCards();
    },
    resetGameForTest(){
      resetGame();
    },
    setGameSpeedForTest(speed){
      return setGameSpeed(speed);
    },
    setWallEditModeForTest(mode){
      return setWallEditMode(mode);
    },
    projectCell(gx, gy){
      const p = gridToWorld(gx, gy).setY(0);
      p.project(camera);
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.left + (p.x + 1) * rect.width / 2,
        y: rect.top + (-p.y + 1) * rect.height / 2
      };
    }
  };

  updateGoldUI(); updateLivesUI(); updateWaveUI();
  let elapsed = 0;
  startGameLoop({
    gameSpeed: () => gameSpeed,
    renderer, camera, scene, coreGroup, coreMesh, portal, updateCamera,
    updateSpawning, updateEnemies, updateTowers, updateProjectiles, updateEffects,
    updatePulses, isGameOver: () => gameOver, isWaveInProgress: () => waveInProgress,
    onElapsed: (value) => { elapsed = value; }
  });
  }

  window.__CORE_DEFENSE__ = {
    getSceneState(){
      return {
        scene: gameStarted ? 'tower-defence-map' : startupStage,
        startupStage,
        selectedClass: selectedClassKey,
        selectedPerks: [...selectedPerkKeys],
        renderStatus: canvas.dataset.renderStatus || 'unknown',
        renderCalls: 0,
        mapCells: 0
      };
    }
  };
  selection.classContinueBtn.addEventListener('click', openPerkSelection);
  selection.classBackBtn.addEventListener('click', () => {
    startupStage = 'main-menu';
    selection.classSelection.classList.add('hidden');
    mainMenu.classList.remove('hidden');
  });
  selection.perkBackBtn.addEventListener('click', openClassSelection);
  selection.deployBtn.addEventListener('click', deployGame);
  startGameBtn.addEventListener('click', startGame);
})();
