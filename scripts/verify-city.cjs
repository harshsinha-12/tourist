// Local visual verification. Supply PLAYWRIGHT_MODULE when using an external runtime.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CITY_BROWSER ? { executablePath: process.env.CITY_BROWSER } : {}) });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.CITY_PREVIEW_URL || 'http://localhost:3000', { waitUntil: 'networkidle' });
  await page.locator('.file-building').first().waitFor();
  await page.waitForFunction(() => {
    const v = document.querySelector('.city-viewport');
    return v && Number(v.dataset.viewportWidth) === v.getBoundingClientRect().width;
  });
  await page.getByRole('button', { name: 'Fit island', exact: true }).click();
  const prefix = process.env.CITY_CAPTURE_PREFIX || '/tmp/tourist-city';
  await page.screenshot({ path: `${prefix}-desktop.png` });
  const canvasBuilding = page.locator('.file-building').filter({ hasText: 'CityCanvas.tsx' });
  const building = await canvasBuilding.count() ? canvasBuilding : page.locator('.file-building').first();
  const label = await building.getAttribute('aria-label');
  await building.click();
  await page.locator('.inspector code').waitFor();
  if ((await page.locator('.inspector code').textContent()) !== label.replace('Inspect ', '')) throw new Error('Wrong file selected');
  await page.locator('.report-toggle').click();
  await page.locator('#report-evidence').waitFor({ state: 'visible' });
  await page.locator('.report-toggle').click();
  await page.getByRole('button', { name: 'File names', exact: true }).click();
  if (await page.getByRole('button', { name: 'File names', exact: true }).getAttribute('aria-pressed') !== 'true') throw new Error('File labels did not toggle');
  await page.getByRole('button', { name: 'Open Town hall', exact: true }).click();
  await page.locator('.operation-modal').waitFor();
  await page.locator('.operation-close').click();
  await page.getByRole('button', { name: '+', exact: true }).click();
  await page.screenshot({ path: `${prefix}-detail.png` });
  await page.getByRole('button', { name: 'Fit island', exact: true }).click();
  const result = await page.evaluate(() => ({
    buildings: document.querySelectorAll('.file-building').length,
    blocks: document.querySelectorAll('.district-block').length,
    missingImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src),
    activeBuilders: document.querySelectorAll('.builder-pawn:not(.builder-pawn-idle)').length,
    environmentAssets: [...new Set([...document.querySelectorAll('img, svg image')].map(i => i.getAttribute('src') || i.getAttribute('href') || '').filter(s => s.includes('/assets/environment/')).map(s => s.split('/').at(-1)))].sort(),
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => Number(document.querySelector('.city-viewport')?.dataset.viewportWidth) === 390);
  await page.screenshot({ path: `${prefix}-mobile.png` });
  await page.getByRole('button', { name: 'File names', exact: true }).click();
  if (errors.length || result.missingImages.length) throw new Error(JSON.stringify({ errors, ...result }));
  fs.writeFileSync('/tmp/tourist-city-browser-check.json', JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
