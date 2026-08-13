import { expect, test } from '@playwright/test';

async function gotoGame(page) {
  await page.goto('./');
  await page.locator('#startGameBtn').click();
  await page.locator('[data-class-key="engineer"]').click();
  await page.locator('#classContinueBtn').click();
  await page.locator('#deployBtn').click();
}

async function chooseEngineer(page) {
  await page.locator('#startGameBtn').click();
  await page.locator('[data-class-key="engineer"]').click();
  await page.locator('#classContinueBtn').click();
}

async function dispatchTouchPointer(page, type, pointerId, point) {
  await page.locator('#gameCanvas').dispatchEvent(type, {
    pointerId,
    pointerType: 'touch',
    isPrimary: pointerId === 1,
    button: 0,
    buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    clientX: point.x,
    clientY: point.y
  });
}

test('shows the main menu and starts the tower defence map', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('#mainMenu')).toBeVisible();
  await expect(page.locator('#gameCanvas')).toBeHidden();
  await expect(page.locator('#hud')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({
    scene: 'main-menu',
    renderStatus: 'unknown',
    mapCells: 0
  });
  await expect(page.locator('#startGameBtn')).toHaveText('START GAME');
  await expect(page.locator('#settingsBtn')).toHaveText('SETTINGS');
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#mainMenu')).toBeVisible();
  await chooseEngineer(page);
  await expect(page.locator('#perkCards .perk-card')).toHaveCount(2);
  await page.locator('#deployBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#mainMenu')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().scene)).toBe('tower-defence-map');
  await expect(page.locator('.brand')).toHaveText('CORE://DEFENSE');
  await expect(page.locator('.stat.gold label')).toHaveText('GOLD');
  await expect(page.locator('#goldVal')).toHaveText('150');
  await expect(page.locator('#livesVal')).toHaveText('20');
  await expect(page.locator('#waveVal')).toHaveText('0');
  await expect(page.locator('#nodeCards .node-card')).toHaveCount(3);
  await expect(page.locator('#gameCanvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({
    renderStatus: 'ready',
    mapCells: 96
  });
});

test('shows game speed controls with normal speed active', async ({page}) => {
  await gotoGame(page);
  await expect(page.locator('.speed-btn')).toHaveCount(3);
  await expect(page.locator('.speed-btn.active')).toHaveText('1x');
  await expect(page.locator('.speed-btn[data-speed="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().gameSpeed)).toBe(1);
});

test('selects an engineer loadout before deployment', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('#hud')).toHaveCount(0);
  await page.locator('#startGameBtn').click();
  await expect(page.locator('#classSelection')).toBeVisible();
  await expect(page.locator('#gameCanvas')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({startupStage: 'class-selection', mapCells: 0, selectedClass: null, selectedPerks: []});

  await page.locator('[data-class-key="engineer"]').click();
  await page.locator('#classContinueBtn').click();
  await expect(page.locator('#perkSelection')).toBeVisible();
  await expect(page.locator('.perk-card')).toHaveCount(2);
  await expect(page.locator('.perk-card.selected')).toHaveCount(0);
  await page.locator('[data-perk-key="tower-upgrades"]').click();
  await page.locator('[data-perk-key="gold-interest"]').click();
  await expect(page.locator('.perk-card.selected')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({startupStage: 'perk-selection', selectedClass: 'engineer', selectedPerks: ['tower-upgrades', 'gold-interest'], mapCells: 0});

  await page.locator('#deployBtn').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#activeClassName')).toHaveText('The Engineer');
  await expect(page.locator('#activePerks')).toContainText('Tower Upgrades');
  await expect(page.locator('#activePerks')).toContainText('Gold Interest');
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({scene: 'tower-defence-map', selectedClass: 'engineer', selectedPerks: ['tower-upgrades', 'gold-interest'], mapCells: 96});
});

test('shows wall mode controls with normal mode active', async ({page}) => {
  await gotoGame(page);
  await expect(page.locator('.wall-mode-btn')).toHaveText(['Normal', 'Build', 'Remove']);
  await expect(page.locator('.wall-mode-btn.active')).toHaveText('Normal');
  await expect(page.locator('.wall-mode-btn[data-wall-mode="normal"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().wallEditMode)).toBe('normal');
});

test('switches wall modes and resets to normal', async ({page}) => {
  await gotoGame(page);
  for (const mode of ['build', 'remove', 'normal']) {
    await page.locator(`.wall-mode-btn[data-wall-mode="${mode}"]`).click();
    await expect(page.locator('.wall-mode-btn.active')).toHaveText(mode[0].toUpperCase() + mode.slice(1));
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().wallEditMode)).toBe(mode);
  }
  await page.locator('[data-wall-mode="build"]').click();
  await page.evaluate(() => window.__CORE_DEFENSE__.resetGameForTest());
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().wallEditMode)).toBe('normal');
});

test('switches between all supported game speeds', async ({page}) => {
  await gotoGame(page);
  for (const speed of ['0.5', '1', '2']) {
    await page.locator(`.speed-btn[data-speed="${speed}"]`).click();
    await expect(page.locator('.speed-btn.active')).toHaveText(`${speed}x`);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().gameSpeed)).toBe(Number(speed));
  }
});

test('scales simulation elapsed time with game speed', async ({page}) => {
  await gotoGame(page);
  await page.evaluate(() => window.__CORE_DEFENSE__.setGameSpeedForTest(0.5));
  const slowStart = await page.evaluate(() => ({
    realTime: performance.now(),
    simulationTime: window.__CORE_DEFENSE__.getSceneState().simulationElapsed
  }));
  await page.waitForFunction((start) => window.__CORE_DEFENSE__.getSceneState().simulationElapsed >= start + 0.15, slowStart.simulationTime);
  const slowDuration = await page.evaluate((start) => performance.now() - start, slowStart.realTime);

  await page.evaluate(() => window.__CORE_DEFENSE__.setGameSpeedForTest(2));
  const fastStart = await page.evaluate(() => ({
    realTime: performance.now(),
    simulationTime: window.__CORE_DEFENSE__.getSceneState().simulationElapsed
  }));
  await page.waitForFunction((start) => window.__CORE_DEFENSE__.getSceneState().simulationElapsed >= start + 0.15, fastStart.simulationTime);
  const fastDuration = await page.evaluate((start) => performance.now() - start, fastStart.realTime);

  expect(slowDuration).toBeGreaterThan(fastDuration * 1.5);
});

test('resets game speed and keeps controls usable over the reward overlay', async ({page}) => {
  await gotoGame(page);
  await page.locator('.speed-btn[data-speed="2"]').click();
  await page.evaluate(() => window.__CORE_DEFENSE__.showWaveRewardForTest());
  await expect(page.locator('#rewardOverlay')).toBeVisible();
  await page.locator('.speed-btn[data-speed="0.5"]').click();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().gameSpeed)).toBe(0.5);

  await page.evaluate(() => window.__CORE_DEFENSE__.resetGameForTest());
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().gameSpeed)).toBe(1);
  await expect(page.locator('.speed-btn.active')).toHaveText('1x');
});

test('builds walls, places towers on them, and removes towers safely', async ({page}) => {
  await gotoGame(page);
  await page.locator('[data-wall-mode="build"]').click();
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  const secondCell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 2));
  await page.mouse.move(cell.x, cell.y);
  await page.mouse.down();
  await page.mouse.move(secondCell.x, secondCell.y, {steps: 4});
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({walls: 2});

  await page.locator('[data-wall-mode="normal"]').click();
  await page.locator('#nodeCards .node-card').first().click();
  await expect(page.locator('#nodeCards .node-card').first()).toHaveClass(/active/);

  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({towers: 1, walls: 2});
  await expect(page.locator('#nodeCards .node-card')).toHaveCount(2);
  await expect(page.locator('#goldVal')).toHaveText('150');

  await page.mouse.click(cell.x, cell.y);
  await page.locator('#purgeBtn').click();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({towers: 0, walls: 2});
  await expect(page.locator('#nodeCards .node-card')).toHaveCount(3);
  await page.locator('[data-wall-mode="remove"]').click();
  await page.mouse.move(cell.x, cell.y);
  await page.mouse.down({button: 'right'});
  await page.mouse.move(secondCell.x, secondCell.y, {steps: 4});
  await page.mouse.up({button: 'right'});
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(2);
});

test.describe('mobile canvas controls', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('one-finger drags place or clear walls in the selected mode', async ({page}) => {
    await gotoGame(page);
    const first = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
    const second = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 2));

    await page.locator('[data-wall-mode="build"]').click();
    await dispatchTouchPointer(page, 'pointerdown', 1, first);
    await dispatchTouchPointer(page, 'pointermove', 1, second);
    await dispatchTouchPointer(page, 'pointerup', 1, second);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(2);

    await page.locator('[data-wall-mode="remove"]').click();
    await dispatchTouchPointer(page, 'pointerdown', 1, first);
    await dispatchTouchPointer(page, 'pointermove', 1, second);
    await dispatchTouchPointer(page, 'pointerup', 1, second);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(0);
  });

  test('a touch tap still places the selected tower', async ({page}) => {
    await gotoGame(page);
    const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
    await page.locator('[data-wall-mode="build"]').click();
    await dispatchTouchPointer(page, 'pointerdown', 1, cell);
    await dispatchTouchPointer(page, 'pointerup', 1, cell);
    await page.locator('[data-wall-mode="normal"]').click();
    await page.mouse.click(cell.x, cell.y);
    await page.locator('#nodeCards .node-card').first().click();

    await dispatchTouchPointer(page, 'pointerdown', 1, cell);
    await dispatchTouchPointer(page, 'pointerup', 1, cell);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({towers: 1, walls: 1});
  });

  test('normal touch taps select without editing walls', async ({page}) => {
    await gotoGame(page);
    const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
    await dispatchTouchPointer(page, 'pointerdown', 1, cell);
    await dispatchTouchPointer(page, 'pointerup', 1, cell);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(0);
  });

  test('two-finger pan moves the camera without editing cells', async ({page}) => {
    await gotoGame(page);
    const first = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(3, 1));
    const second = {x: first.x + 80, y: first.y + 20};
    const before = await page.evaluate(() => window.__CORE_DEFENSE__.getSceneState());

    await dispatchTouchPointer(page, 'pointerdown', 1, first);
    await dispatchTouchPointer(page, 'pointerdown', 2, second);
    await dispatchTouchPointer(page, 'pointermove', 1, {x: first.x + 40, y: first.y + 20});
    await dispatchTouchPointer(page, 'pointermove', 2, {x: second.x + 40, y: second.y + 20});
    await dispatchTouchPointer(page, 'pointerup', 1, first);
    await dispatchTouchPointer(page, 'pointerup', 2, second);

    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().cameraTarget)).not.toEqual(before.cameraTarget);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(before.walls);
  });

  test('pinch zoom changes camera distance within its bounds', async ({page}) => {
    await gotoGame(page);
    const center = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(4, 4));
    const left = {x: center.x - 40, y: center.y};
    const right = {x: center.x + 40, y: center.y};

    await dispatchTouchPointer(page, 'pointerdown', 1, left);
    await dispatchTouchPointer(page, 'pointerdown', 2, right);
    await dispatchTouchPointer(page, 'pointermove', 1, {x: center.x - 400, y: center.y});
    await dispatchTouchPointer(page, 'pointermove', 2, {x: center.x + 400, y: center.y});
    await dispatchTouchPointer(page, 'pointerup', 1, left);
    await dispatchTouchPointer(page, 'pointerup', 2, right);

    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().cameraDistance)).toBe(10);
  });

  test('pinch zoom can zoom out farther on mobile', async ({page}) => {
    await gotoGame(page);
    const center = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(4, 4));
    const startLeft = {x: center.x - 520, y: center.y};
    const startRight = {x: center.x + 520, y: center.y};

    await dispatchTouchPointer(page, 'pointerdown', 1, startLeft);
    await dispatchTouchPointer(page, 'pointerdown', 2, startRight);
    for (const offset of [420, 300, 200, 120, 60, 12, 0]) {
      await dispatchTouchPointer(page, 'pointermove', 1, {x: center.x - offset, y: center.y});
      await dispatchTouchPointer(page, 'pointermove', 2, {x: center.x + offset, y: center.y});
    }
    await dispatchTouchPointer(page, 'pointerup', 1, {x: center.x, y: center.y});
    await dispatchTouchPointer(page, 'pointerup', 2, {x: center.x, y: center.y});

    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().cameraDistance)).toBe(55);
  });

  test('continues pinch zoom when one finger is replaced', async ({page}) => {
    await gotoGame(page);
    const center = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(4, 4));
    const first = {x: center.x - 40, y: center.y};
    const second = {x: center.x + 40, y: center.y};

    await dispatchTouchPointer(page, 'pointerdown', 1, first);
    await dispatchTouchPointer(page, 'pointerdown', 2, second);
    await dispatchTouchPointer(page, 'pointermove', 1, {x: center.x - 120, y: center.y});
    await dispatchTouchPointer(page, 'pointermove', 2, {x: center.x + 120, y: center.y});
    const distanceAfterFirstPinch = await page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().cameraDistance);
    await dispatchTouchPointer(page, 'pointerup', 1, first);
    await dispatchTouchPointer(page, 'pointerdown', 3, {x: center.x - 40, y: center.y});
    await dispatchTouchPointer(page, 'pointermove', 2, {x: center.x + 160, y: center.y});
    await dispatchTouchPointer(page, 'pointermove', 3, {x: center.x - 160, y: center.y});
    await dispatchTouchPointer(page, 'pointerup', 2, second);
    await dispatchTouchPointer(page, 'pointerup', 3, {x: center.x - 160, y: center.y});

    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().cameraDistance)).toBeLessThan(distanceAfterFirstPinch);
  });

  test('gesture cancellation and transitions clear wall editing', async ({page}) => {
    await gotoGame(page);
    const first = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
    const second = {x: first.x + 80, y: first.y + 20};

    await dispatchTouchPointer(page, 'pointerdown', 1, first);
    await dispatchTouchPointer(page, 'pointerdown', 2, second);
    await dispatchTouchPointer(page, 'pointercancel', 1, first);
    await dispatchTouchPointer(page, 'pointercancel', 2, second);
    await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().wallEditAction)).toBeNull();
  });

  test('shows the mobile gesture hint', async ({page}) => {
    await gotoGame(page);
    await expect(page.locator('#mobileHint')).toBeVisible();
    await expect(page.locator('#mobileHint')).toHaveText('NORMAL: TAP TO SELECT · BUILD/REMOVE: 1-FINGER TAP/DRAG · 2-FINGER DRAG: PAN · PINCH: ZOOM');
    await expect(page.locator('#desktopHint')).toBeHidden();
  });
});

test('shows the desktop control hint', async ({page}) => {
  await gotoGame(page);
  await expect(page.locator('#desktopHint')).toBeVisible();
  await expect(page.locator('#mobileHint')).toBeHidden();
});

test('pans the camera with a middle-button drag', async ({page}) => {
  await gotoGame(page);
  const start = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(4, 3));
  const before = await page.evaluate(() => window.__CORE_DEFENSE__.getSceneState());

  await page.mouse.move(start.x, start.y);
  await page.mouse.down({button: 'middle'});
  await page.mouse.move(start.x + 80, start.y + 30, {steps: 3});
  await page.mouse.up({button: 'middle'});

  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().cameraTarget)).not.toEqual(before.cameraTarget);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(before.walls);
});

test('starts with one deterministic tile of each type', async ({page}) => {
  await gotoGame(page);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().tiles)).toEqual([
    {type: 'tile', key: 'slow', gx: 2, gy: 1},
    {type: 'tile', key: 'dot', gx: 0, gy: 1},
    {type: 'tile', key: 'buff', gx: 3, gy: 3}
  ]);
  await expect(page.locator('#nodeCards .tile-card')).toHaveCount(0);
});

test('shows effect tile details while hovering without a selection panel', async ({page}) => {
  await gotoGame(page);
  const tile = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(2, 1));

  await page.mouse.move(tile.x, tile.y);
  await expect(page.locator('#tileTooltip')).toBeVisible();
  await expect(page.locator('#tileTooltipName')).toHaveText('DRAG FIELD');
  await expect(page.locator('#tileTooltipDescription')).toHaveText('Slows enemies by 25% while they occupy this cell.');

  await page.mouse.move(0, 0);
  await expect(page.locator('#tileTooltip')).toBeHidden();

  await page.mouse.click(tile.x, tile.y);
  await expect(page.locator('#selectedPanel')).toBeHidden();
});

test('applies the initial damage-over-time tile to enemies on the route', async ({page}) => {
  await gotoGame(page);
  await page.locator('#waveBtn').click();

  await expect.poll(
    () => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().enemyEffects),
    {timeout: 10000}
  ).toContainEqual(expect.objectContaining({activeTile: 'dot', dotDamage: 3}));
});

test('places a rewarded tile and restores the initial layout on reset', async ({page}) => {
  await gotoGame(page);
  await page.evaluate(() => window.__CORE_DEFENSE__.grantRewardForTest('tile', 'dot'));
  await page.locator('#nodeCards .tile-card[data-key="dot"]').last().click();
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(8, 0));
  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().tiles)).toHaveLength(4);
  await expect(page.locator('#nodeCards .tile-card[data-key="dot"]')).toHaveCount(0);
  await page.evaluate(() => window.__CORE_DEFENSE__.resetGameForTest());
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().tiles)).toEqual([
    {type: 'tile', key: 'slow', gx: 2, gy: 1},
    {type: 'tile', key: 'dot', gx: 0, gy: 1},
    {type: 'tile', key: 'buff', gx: 3, gy: 3}
  ]);
  await expect(page.locator('#nodeCards .tile-card')).toHaveCount(0);
});

test('purchases escalating upgrades and preserves them through purge', async ({page}) => {
  await page.goto('./');
  await page.locator('#startGameBtn').click();
  await page.locator('[data-class-key="engineer"]').click();
  await page.locator('#classContinueBtn').click();
  await page.locator('[data-perk-key="tower-upgrades"]').click();
  await page.locator('#deployBtn').click();
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.locator('[data-wall-mode="build"]').click();
  await page.mouse.click(cell.x, cell.y);
  await page.locator('[data-wall-mode="normal"]').click();
  await page.locator('#nodeCards .node-card').first().click();
  await page.mouse.click(cell.x, cell.y);
  await page.mouse.click(cell.x, cell.y);

  await expect(page.locator('#selectedPanel')).toBeVisible();
  await expect(page.locator('#damageUpgradeCost')).toHaveText('⬡ 40');
  await page.locator('#upgradeDamageBtn').click();
  await expect(page.locator('#goldVal')).toHaveText('110');
  await expect(page.locator('#damageUpgradeCost')).toHaveText('⬡ 60');
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({
    towerUpgrades: [{damage: 1, range: 0, fireRate: 0}],
    towerStats: [{damage: 9.6, range: 4.2, fireRate: 2.5}]
  });

  await page.locator('#purgeBtn').click();
  await page.locator('#nodeCards .node-card[data-key="filter"]').click();
  await page.mouse.click(cell.x, cell.y);
  await page.mouse.click(cell.x, cell.y);

  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({
    towerUpgrades: [{damage: 1, range: 0, fireRate: 0}]
  });
});

test('gates tower upgrades behind the tower-upgrades perk', async ({page}) => {
  await gotoGame(page);
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.locator('[data-wall-mode="build"]').click();
  await page.mouse.click(cell.x, cell.y);
  await page.locator('[data-wall-mode="normal"]').click();
  await page.locator('#nodeCards .node-card').first().click();
  await page.mouse.click(cell.x, cell.y);
  await page.mouse.click(cell.x, cell.y);

  await expect(page.locator('#upgradeDamageBtn')).toBeDisabled();
  await expect(page.locator('#goldVal')).toHaveText('150');
});

test('awards gold interest when a wave ends', async ({page}) => {
  await page.goto('./');
  await page.locator('#startGameBtn').click();
  await page.locator('[data-class-key="engineer"]').click();
  await page.locator('#classContinueBtn').click();
  await page.locator('[data-perk-key="gold-interest"]').click();
  await page.locator('#deployBtn').click();
  await page.evaluate(() => window.__CORE_DEFENSE__.completeWaveForTest());
  await expect(page.locator('#goldVal')).toHaveText('165');
  await expect(page.locator('#rewardOverlay')).toBeVisible();
});

test('starts a wave after selecting a tower', async ({page}) => {
  await gotoGame(page);
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.locator('[data-wall-mode="build"]').click();
  await page.mouse.click(cell.x, cell.y);
  await page.locator('[data-wall-mode="normal"]').click();
  await page.locator('#nodeCards .node-card').first().click();
  await page.mouse.move(0, 0);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().previewVisible)).toBe(false);
  await page.mouse.move(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().previewVisible)).toBe(true);
  await page.mouse.click(cell.x, cell.y);

  await page.locator('#waveBtn').click();
  await expect(page.locator('#waveVal')).toHaveText('1');
  await expect(page.locator('#waveBtn')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().enemies)).toBeGreaterThan(0);
});

test('updates active enemy routes when a wall is placed', async ({page}) => {
  await gotoGame(page);
  await page.locator('[data-wall-mode="build"]').click();
  await page.locator('#waveBtn').click();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().enemies)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().enemyPositions[0][0])).toBeGreaterThan(-12.5);

  const before = await page.evaluate(() => window.__CORE_DEFENSE__.getSceneState());
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(2, 1));
  await page.mouse.click(cell.x, cell.y);

  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(1);
  const after = await page.evaluate(() => window.__CORE_DEFENSE__.getSceneState());
  expect(after.routeVersion).toBeGreaterThan(before.routeVersion);
  expect(after.enemyRouteVersions.every((version) => version === after.routeVersion)).toBe(true);
  const [routeStartX, routeStartZ] = after.enemyRouteStarts[0];
  const [beforeX, beforeZ] = before.enemyPositions[0];
  expect(Math.hypot(beforeX - routeStartX, beforeZ - routeStartZ)).toBeLessThan(0.5);
});

test('shows three reward choices and adds the selected tower to inventory', async ({page}) => {
  await gotoGame(page);
  await page.evaluate(() => window.__CORE_DEFENSE__.showWaveRewardForTest());

  await expect(page.locator('#rewardOverlay')).toBeVisible();
  await expect(page.locator('#rewardCards .reward-card')).toHaveCount(3);

  const rewardKey = await page.locator('#rewardCards .reward-card').first().getAttribute('data-key');
  const rewardType = await page.locator('#rewardCards .reward-card').first().getAttribute('data-type');
  const beforeCount = await page.evaluate(({key, type}) => window.__CORE_DEFENSE__.getSceneState().inventoryItems.filter((item) => item.key === key && item.type === type).length, {key: rewardKey, type: rewardType});
  await page.locator('#rewardCards .reward-card').first().click();

  await expect(page.locator('#rewardOverlay')).toBeHidden();
  await expect.poll(() => page.evaluate(({key, type}) => window.__CORE_DEFENSE__.getSceneState().inventoryItems.filter((item) => item.key === key && item.type === type).length, {key: rewardKey, type: rewardType})).toBe(beforeCount + 1);
  const rewardCards = page.locator(`#nodeCards .node-card[data-key="${rewardKey}"][data-type="${rewardType}"]`);
  await expect(rewardCards).toHaveCount(beforeCount + 1);
  const cardPositions = await rewardCards.evaluateAll((cards) => cards.map((card) => {
    const bounds = card.getBoundingClientRect();
    return {left: bounds.left, top: bounds.top};
  }));
  expect(cardPositions[0]).not.toEqual(cardPositions[1]);
});

test('applies and preserves a stacked enchantment on a tower', async ({page}) => {
  await gotoGame(page);
  await page.evaluate(() => window.__CORE_DEFENSE__.grantRewardForTest('enchantment', 'burn'));
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.locator('[data-wall-mode="build"]').click();
  await page.mouse.click(cell.x, cell.y);
  await page.locator('[data-wall-mode="normal"]').click();
  await page.locator('#nodeCards .node-card[data-type="tower"]').first().click();
  await page.mouse.click(cell.x, cell.y);
  await page.evaluate(() => window.__CORE_DEFENSE__.grantRewardForTest('enchantment', 'burn'));
  await page.locator('#nodeCards .node-card[data-type="enchantment"][data-key="burn"]').first().click();
  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({
    towerEnchantments: [['burn']]
  });
  await page.evaluate(() => window.__CORE_DEFENSE__.grantRewardForTest('enchantment', 'burn'));
  await page.locator('#nodeCards .node-card[data-type="enchantment"][data-key="burn"]').first().click();
  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().towerEnchantments)).toEqual([['burn', 'burn']]);
  await page.locator('#purgeBtn').click();
  await page.locator('#nodeCards .node-card[data-type="tower"][data-key="filter"]').click();
  await page.mouse.click(cell.x, cell.y);
  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().towerEnchantments)).toEqual([['burn', 'burn']]);
});
