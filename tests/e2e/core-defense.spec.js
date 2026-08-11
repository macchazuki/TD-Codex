import { expect, test } from '@playwright/test';

test('loads the game and exposes the initial HUD', async ({page}) => {
  await page.goto('./');
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

test('builds walls, places towers on them, and removes towers safely', async ({page}) => {
  await page.goto('./');
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  const secondCell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 2));
  await page.mouse.move(cell.x, cell.y);
  await page.mouse.down();
  await page.mouse.move(secondCell.x, secondCell.y, {steps: 4});
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({walls: 2});

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
  await page.mouse.move(cell.x, cell.y);
  await page.mouse.down({button: 'right'});
  await page.mouse.move(secondCell.x, secondCell.y, {steps: 4});
  await page.mouse.up({button: 'right'});
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().walls)).toBe(0);
});

test('starts with one deterministic tile of each type', async ({page}) => {
  await page.goto('./');
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().tiles)).toEqual([
    {type: 'tile', key: 'slow', gx: 2, gy: 1},
    {type: 'tile', key: 'dot', gx: 0, gy: 1},
    {type: 'tile', key: 'buff', gx: 3, gy: 3}
  ]);
  await expect(page.locator('#nodeCards .tile-card')).toHaveCount(0);
});

test('applies the initial damage-over-time tile to enemies on the route', async ({page}) => {
  await page.goto('./');
  await page.locator('#waveBtn').click();

  await expect.poll(
    () => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState().enemyEffects),
    {timeout: 10000}
  ).toContainEqual(expect.objectContaining({activeTile: 'dot', dotDamage: 3}));
});

test('places a rewarded tile and restores the initial layout on reset', async ({page}) => {
  await page.goto('./');
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
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.mouse.click(cell.x, cell.y);
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

test('starts a wave after selecting a tower', async ({page}) => {
  await page.goto('./');
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.mouse.click(cell.x, cell.y);
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
  await page.goto('./');
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
  await page.goto('./');
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
