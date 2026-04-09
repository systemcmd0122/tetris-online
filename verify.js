const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Verifying index.html...');
  await page.goto('http://localhost:8080/index.html');
  const version = await page.textContent('#versionDisp');
  console.log('Version found:', version);
  if (!version.includes('3.2.0')) {
    console.error('Wrong version on index.html');
    process.exit(1);
  }

  console.log('Verifying tetris-battle.html (VS BOT)...');
  await page.goto('http://localhost:8080/tetris-battle.html');
  await page.waitForSelector('.diff-easy');
  console.log('Difficulty buttons found.');

  console.log('Verifying admin.html...');
  await page.goto('http://localhost:8080/admin.html');
  await page.fill('#pwIn', 'Runa1124');
  await page.click('button:has-text("ログイン")');
  await page.waitForSelector('#panel-feedback');
  console.log('Admin feedback panel found.');

  console.log('Verifying status.html for duplicate IDs...');
  await page.goto('http://localhost:8080/status.html');
  const banners = await page.$$('[id="noticeBanner"]');
  console.log('Number of noticeBanner IDs:', banners.length);
  if (banners.length !== 1) {
    console.error('Duplicate or missing noticeBanner ID!');
    process.exit(1);
  }

  console.log('All basic verifications passed.');
  await browser.close();
})();
