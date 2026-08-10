import { expect, test } from '@playwright/test';

test('loads the game and exposes the initial HUD', async ({page}) => {
  await page.goto('./');
  await expect(page.locator('.brand')).toHaveText('CORE://DEFENSE');
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
  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({walls: 1});

  await page.locator('#nodeCards .node-card').first().click();
  await expect(page.locator('#nodeCards .node-card').first()).toHaveClass(/active/);

  await page.mouse.click(cell.x, cell.y);
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({towers: 1, walls: 1});
  await expect(page.locator('#goldVal')).toHaveText('100');

  await page.locator('#purgeBtn').click();
  await expect.poll(() => page.evaluate(() => window.__CORE_DEFENSE__.getSceneState())).toMatchObject({towers: 0, walls: 1});
  await page.mouse.click(cell.x, cell.y);
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
