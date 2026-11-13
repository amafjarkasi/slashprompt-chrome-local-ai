import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const TEST_HTML = `<!doctype html>
<html>
  <head><title>SlashPrompt E2E Test</title></head>
  <body style="font-family: sans-serif; padding: 40px;">
    <h2>E2E Sandbox</h2>
    <textarea id="ta" rows="4" cols="50" placeholder="Textarea"></textarea>
    <br /><br />
    <div id="ce" contenteditable="true" style="border: 1px solid #ccc; padding: 12px; min-height: 60px; width: 400px;"></div>
    <br />
    <input id="url-input" type="text" style="width: 400px; padding: 8px;" />
  </body>
</html>`;

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(TEST_HTML);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const testUrl = `http://127.0.0.1:${port}/`;

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'slashprompt-e2e-'));

const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  args: [
    `--disable-extensions-except=${distDir}`,
    `--load-extension=${distDir}`,
    '--no-sandbox',
  ],
});

try {
  // Wait for MV3 service worker to register and get extension ID
  let [sw] = context.serviceWorkers();
  if (!sw) {
    sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }
  const extId = new URL(sw.url()).host;
  assert.ok(extId, 'Extension ID should be present');
  console.log(`✓ Extension loaded (ID: ${extId})`);

  // 1. Test Extension Popup UI & enable Demo Fallback for deterministic E2E testing
  const popupPage = await context.newPage();
  await popupPage.goto(`chrome-extension://${extId}/popup.html`);

  await popupPage.click('[data-tab="settings"]');
  const statusCards = await popupPage.locator('.status-card').count();
  assert.equal(statusCards, 5, 'Should display all 5 Chrome Built-in AI API status cards');

  await popupPage.check('#setting-demo');
  await popupPage.click('[data-tab="playground"]');
  await popupPage.fill('#pg-input', 'write a unit test for login');
  await popupPage.click('#pg-run');

  await popupPage.waitForFunction(() => {
    const out = document.querySelector('#pg-output')?.textContent ?? '';
    return out.length > 20 && !document.querySelector('#pg-run')?.disabled;
  });
  const pgOutput = await popupPage.locator('#pg-output').textContent();
  assert.ok(pgOutput.includes('write a unit test for login'), 'Popup playground should enhance prompt');
  console.log('✓ Popup UI, AI status cards, settings, and playground verified');
  await popupPage.close();

  // 2. Test inline // enhancement on <textarea>
  const page = await context.newPage();
  await page.goto(testUrl);

  const ta = page.locator('#ta');
  await ta.click();
  await ta.type('// write a python web scraper');

  const pill = page.locator('#slashprompt-overlay-host >> [data-testid="slashprompt-pill"]');
  await pill.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Floating pill appeared on // in <textarea>');

  await page.locator('#slashprompt-overlay-host >> [data-testid="slashprompt-enhance-btn"]').click();

  const replaceBtn = page.locator('#slashprompt-overlay-host >> [data-testid="slashprompt-replace-btn"]');
  await replaceBtn.waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => {
    const host = document.querySelector('#slashprompt-overlay-host');
    const btn = host?.shadowRoot?.querySelector('[data-testid="slashprompt-replace-btn"]');
    return btn && !btn.disabled;
  });

  await replaceBtn.click();
  const taVal = await ta.inputValue();
  assert.ok(!taVal.startsWith('//'), 'Original // prefix should be replaced');
  assert.ok(taVal.length > 30, 'Textarea should contain enhanced prompt');
  console.log('✓ <textarea> replaced with enhanced prompt');

  // 3. Test inline // enhancement on contenteditable with Ctrl+Enter shortcut
  const ce = page.locator('#ce');
  await ce.click();
  await page.keyboard.type('// summarize quarterly sales report');

  await pill.waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Control+Enter');

  await page.waitForFunction(() => {
    const host = document.querySelector('#slashprompt-overlay-host');
    const btn = host?.shadowRoot?.querySelector('[data-testid="slashprompt-replace-btn"]');
    return btn && !btn.disabled;
  });
  await page.locator('#slashprompt-overlay-host >> [data-testid="slashprompt-replace-btn"]').click();

  const ceText = (await ce.textContent()) ?? '';
  assert.ok(!ceText.startsWith('//'), 'contenteditable // prefix should be replaced');
  assert.ok(ceText.includes('quarterly sales report'), 'contenteditable should contain enhanced prompt');
  console.log('✓ contenteditable replaced with enhanced prompt via Ctrl+Enter');

  // 4. Verify URLs like https://example.com do NOT trigger the pill
  const urlInput = page.locator('#url-input');
  await urlInput.click();
  await urlInput.type('https://example.com/test');
  await page.waitForTimeout(200);
  const pillCount = await page.locator('#slashprompt-overlay-host >> [data-testid="slashprompt-pill"]').count();
  assert.equal(pillCount, 0, 'URL with https:// must not trigger floating pill');
  console.log('✓ URL false-positive guard verified');

  console.log('\nALL E2E TESTS PASSED!');
} finally {
  await context.close();
  server.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
