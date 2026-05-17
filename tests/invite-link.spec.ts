import { test, expect } from '@playwright/test';

test('招待リンクのURLパラメータによってルームコードが自動入力される', async ({ page }) => {
  // room=9999 パラメータを付けてページを開く
  await page.goto('http://localhost:3000/tetris-multi.html?room=9999');

  // ページ読み込みを待機
  await page.waitForLoadState('networkidle');

  // ルームコード入力欄の値を確認
  const roomInput = page.locator('#roomCodeInput');
  await expect(roomInput).toHaveValue('9999');
});

test('待機画面に招待リンクコピーボタンが存在する', async ({ page }) => {
  await page.goto('http://localhost:3000/tetris-multi.html');

  // ルーム作成（モックはせず、要素の存在確認をメインとする）
  // ログインしていないとルーム作成できない可能性があるが、UIの静的な存在は確認できる
  const waitingScreen = page.locator('#waitingScreen');
  const copyInviteBtn = waitingScreen.locator('button:has-text("招待リンクをコピー")');

  // 初期状態では waitingScreen は非表示だが、HTML構造には存在しているはず
  await expect(copyInviteBtn).toBeAttached();
});
