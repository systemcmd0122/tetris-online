import { test, expect } from '@playwright/test';

test('verify ai-battle.html has no console errors and starts game', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (exception) => {
    errors.push(exception.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('http://localhost:3000/ai-battle.html');

  // Wait for some time to let the game initialize and bots start playing
  await page.waitForTimeout(5000);

  // Check for console errors
  expect(errors).toEqual([]);

  // Check if arena grid is populated
  const botCards = await page.locator('.bot-card').count();
  expect(botCards).toBeGreaterThan(0);

  // Check if system log has some content beyond initial
  const logContent = await page.locator('#systemLog').innerText();
  expect(logContent).toContain('MATCH START');

  await page.screenshot({ path: 'ai-battle-verification.png' });
});
