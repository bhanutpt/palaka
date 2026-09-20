import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { editor, text } from './helpers';

const saved = (page: import('@playwright/test').Page) => expect(page.locator('#status-saved')).toHaveText('Saved');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await editor(page).click();
});

test('text is autosaved and comes back after a reload', async ({ page }) => {
  await page.keyboard.type('nEnu telugu rAstunnAnu');
  await expect(page.locator('#status-saved')).toHaveText('Edited');
  await saved(page);
  await page.reload();
  expect(await text(page)).toBe('నేను తెలుగు రాస్తున్నాను');
});

test('text survives a tab that is closed straight after typing', async ({ page, context }) => {
  await page.keyboard.type('palaka');
  await page.close({ runBeforeUnload: true });

  const again = await context.newPage();
  await again.goto('/');
  await expect(again.locator('#editor .cm-line').first()).toHaveText('పలక');
});

test('documents: new, switch, rename, delete', async ({ page }) => {
  await page.keyboard.type('okaTi');
  await saved(page);
  await page.locator('#doc-new').click();
  await expect(page.locator('#editor .cm-line')).toHaveText(['']);
  await page.keyboard.type('reMDu');
  await saved(page);

  await page.locator('#docs-toggle').click();
  await expect(page.locator('.doc-item .doc-title')).toHaveText(['రెండు', 'ఒకటి']);
  await expect(page.locator('.doc-item.is-current .doc-title')).toHaveText('రెండు');

  await page.locator('.doc-item', { hasText: 'ఒకటి' }).locator('.doc-open').click();
  await expect(page.locator('#editor .cm-line')).toHaveText(['ఒకటి']);

  // Undo must not reach into the document that was open before.
  await page.keyboard.press('Control+z');
  expect(await text(page)).toBe('ఒకటి');

  page.once('dialog', (dialog) => dialog.accept('మొదటి పాఠం'));
  await page.locator('.doc-item.is-current .doc-rename').click();
  await expect(page.locator('.doc-item.is-current .doc-title')).toHaveText('మొదటి పాఠం');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.doc-item.is-current .doc-delete').click();
  await expect(page.locator('.doc-item .doc-title')).toHaveText(['రెండు']);
  await expect(page.locator('#editor .cm-line')).toHaveText(['రెండు']);

  await page.reload();
  expect(await text(page)).toBe('రెండు');
});

test('opens a .txt file, cleaned up, as a new document', async ({ page }) => {
  const twoPartAi = String.fromCharCode(0x0c15, 0x0c46, 0x0c56);
  await page.locator('#file-input').setInputFiles({
    name: 'lesson.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(`\uFEFFపాఠం\r\n${twoPartAi}`, 'utf8'),
  });
  await expect(page.locator('#editor .cm-line')).toHaveText(['పాఠం', 'కై']);
  await page.locator('#docs-toggle').click();
  await expect(page.locator('.doc-item.is-current .doc-title')).toHaveText('lesson.txt');
});

test('saves the text as a UTF-8 .txt file', async ({ page }) => {
  await page.keyboard.type('telugu');
  await page.keyboard.press('Enter');
  await page.keyboard.type('palaka');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#doc-save').click()]);
  expect(download.suggestedFilename()).toBe('తెలుగు.txt');
  expect(readFileSync(await download.path(), 'utf8')).toBe('తెలుగు\nపలక');
});

test('copy all puts the whole text on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.keyboard.type('palaka telugu');
  await page.locator('#copy-all').click();
  await expect(page.locator('#status-message')).toHaveText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('పలక తెలుగు');
});

test('settings: theme, font and size apply at once and persist', async ({ page }) => {
  await page.locator('#settings-open').click();
  await page.locator('#set-theme').selectOption('dark');
  await page.locator('#set-font').selectOption('serif');
  await page.locator('#set-font-size').fill('28');
  await page.locator('#set-font-size').blur();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#editor .cm-scroller')).toHaveCSS('font-size', '28px');
  await expect(page.locator('#editor .cm-scroller')).toHaveCSS('font-family', /Noto Serif Telugu/);
  const background = await page.locator('body').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe('rgb(251, 250, 247)');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#editor .cm-scroller')).toHaveCSS('font-size', '28px');
});

test('settings: Telugu digits and the mode-switch shortcut', async ({ page }) => {
  await page.keyboard.type('5 ');
  await page.locator('#settings-open').click();
  await page.locator('#set-digits').check();
  await page.locator('#set-shortcut').selectOption('F9');
  await page.locator('#settings-close').click();

  await editor(page).click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('5 ');
  await page.keyboard.press('F9');
  await expect(page.locator('#mode-toggle')).toHaveText(/English/);
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#mode-toggle')).toHaveText(/English/);
  expect(await text(page)).toBe('5 ౫ ');
});

test('the bundled Telugu fonts are used, from this site only', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(page.url()).origin) foreign.push(request.url());
  });
  await page.keyboard.type('telugu');
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("20px 'Noto Sans Telugu Variable'", 'తెలుగు'))).toBe(true);
  expect(foreign).toEqual([]);
});

test('the app is installable and loads with the network switched off', async ({ page, context }) => {
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ name: 'పలక — Palaka', short_name: 'పలక', display: 'standalone' });
  // The name is plain పలక wherever the app shows it: the heading and the title of the window.
  await expect(page.locator('#toolbar h1')).toHaveText('పలక');
  expect(await page.title()).toMatch(/ — పలక$/);
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));

  await page.keyboard.type('palaka');
  await saved(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Give the service worker a moment to finish caching the files.
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).length), { timeout: 15000 })
    .toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#editor .cm-line').first()).toHaveText('పలక');
  await expect(page.locator('[data-tile="k"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("20px 'Noto Sans Telugu Variable'", 'తెలుగు'))).toBe(true);
});
