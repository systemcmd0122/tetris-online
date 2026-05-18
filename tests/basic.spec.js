import { test, expect } from '@playwright/test';

test.describe('TETRIS BATTLE ONLINE 統合テスト', () => {
  test('マルチプレイ画面の基本コンポーネントがロードされること', async ({ page }) => {
    await page.goto('/tetris-multi.html');
    await expect(page.locator('#lobbyScreen .logo')).toContainText('TETRIS');
    await expect(page.locator('#lobbyScreen')).toBeVisible();
  });

  test('エンジンと決定論的バッグの初期化', async ({ page }) => {
    await page.goto('/tetris-multi.html');
    await page.waitForFunction(() => typeof window.TetrisGameWrapper !== 'undefined');
    const bagContent = await page.evaluate(() => {
        const wrapper = new window.TetrisGameWrapper('myCanvas', null, null, 12345);
        return wrapper.engine.bag.peek(5);
    });
    expect(bagContent.length).toBe(5);
  });

  test('リプレイビューアーが動作すること', async ({ page }) => {
    await page.goto('/replay.html');
    await expect(page.locator('.logo')).toContainText('REPLAY');
    const frameInfo = await page.locator('#frameInfo').textContent();
    expect(frameInfo).toContain('FRAME:');
  });
});
