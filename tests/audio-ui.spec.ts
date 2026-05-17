import { test, expect } from '@playwright/test';

test('サウンド設定モーダルにサウンドモード選択ボタンが存在する', async ({ page }) => {
  await page.goto('http://localhost:3000/tetris-multi.html');

  // SOUND設定ボタンをクリック（ゲーム画面に移動する必要があるが、UIコンポーネントがグローバルにインジェクションされているか確認）
  // 実際には audioUI.show() が呼ばれるとモーダルが表示される。
  // テストを簡単にするため、スクリプトを実行してモーダルを表示させる。
  await page.evaluate(() => {
    window.audioUI.show();
  });

  const modal = page.locator('#audioSettingsModal');
  await expect(modal).toBeVisible();

  const neonBtn = modal.locator('button[data-mode="neon"]');
  const softBtn = modal.locator('button[data-mode="soft"]');

  await expect(neonBtn).toBeVisible();
  await expect(softBtn).toBeVisible();

  // SOFTボタンをクリックして、activeクラスが付与されるか確認
  await softBtn.click();
  await expect(softBtn).toHaveClass(/active/);
});
