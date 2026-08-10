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

test('starts a wave after selecting a tower', async ({page}) => {
  await page.goto('./');
  const cell = await page.evaluate(() => window.__CORE_DEFENSE__.projectCell(0, 0));
  await page.mouse.click(cell.x, cell.y);
  await page.locator('#nodeCards .node-card').first().click();
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
