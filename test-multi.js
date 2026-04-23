const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('--- Testing Multiplayer Logic (Mock Simulation) ---');

  await page.goto('http://localhost:3000/tetris-multi.html');
  await page.waitForTimeout(2000);

  const title = await page.title();
  console.log('Page Title:', title);

  // Enter name
  await page.fill('#playerName', 'TEST_PLAYER');
  console.log('Player name entered.');

  // Click Create Room
  await page.click('button:has-text("ルームを作成して待機")');
  console.log('Clicked "Create Room".');

  await page.waitForSelector('#displayRoomCode');
  const roomCode = await page.innerText('#displayRoomCode');
  console.log('Room Code generated:', roomCode);

  await page.screenshot({ path: 'lobby-waiting.png' });

  // Simulation: Since we can't easily run multiple browsers in this limited environment with Firebase,
  // we primarily check if the UI transitions correctly.

  // Cancel Waiting
  await page.click('button:has-text("CANCEL")');
  console.log('Clicked "CANCEL".');
  await page.waitForSelector('#lobbyScreen.active');
  console.log('Returned to lobby.');

  await browser.close();
})();
