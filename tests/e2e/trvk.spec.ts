import { expect, test, type Page } from '@playwright/test';
import { clear, editor, text } from './helpers';

/**
 * TRVK mode in the built app, with the real model: the download, the correction, the promise
 * that nothing leaves this origin, and the offline promise after the first switch-on.
 *
 * These are the only tests that run the model in a browser. They are slower than the rest of
 * the suite because the first one downloads 13.9 MB from the preview server.
 */

const MODEL_TIMEOUT = 120_000;

/** Turns the mode on in the settings; the editor switch then cycles Telugu → TRVK → English. */
async function enableTrvk(page: Page) {
  await page.locator('#settings-open').click();
  await page.locator('#set-trvk').check();
  await page.locator('#settings-close').click();
}

/** Switches the editor into TRVK mode and waits for the model to be ready. */
async function intoTrvk(page: Page) {
  await editor(page).click();
  await page.locator('#mode-toggle').click();
  await expect(page.locator('#status-mode')).toHaveText('TRVK');
  await expect(page.locator('body')).toHaveAttribute('data-trvk', 'ready', { timeout: MODEL_TIMEOUT });
}

test.describe('TRVK mode', () => {
  test.describe.configure({ mode: 'serial' });

  test('is not there at all until the writer asks for it', async ({ page }) => {
    const elsewhere: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/trvk/')) elsewhere.push(request.url());
    });
    await page.goto('/');
    await editor(page).click();

    // The switch goes straight from Telugu to English, and nothing of the model is fetched.
    await page.locator('#mode-toggle').click();
    await expect(page.locator('#status-mode')).toHaveText('English');
    await page.waitForTimeout(500);
    expect(elsewhere).toEqual([]);
  });

  test('corrects loose roman as it is typed, and again once the next word appears', async ({ page }) => {
    await page.goto('/');
    await enableTrvk(page);
    await intoTrvk(page);

    // The rule table renders `nenu` as నెను at once; the model makes it నేను.
    await page.keyboard.type('nenu');
    expect(await text(page)).toBe('నెను');
    await expect(editor(page)).toHaveText('నేను', { timeout: 10_000 });

    // `eeroju` decides nothing about `nenu`, but the second pass runs with it in view.
    await page.keyboard.type(' eeroju intiki vellanu');
    await expect(editor(page)).toHaveText('నేను ఈరోజు ఇంటికి వేళ్ళను', { timeout: 15_000 });
    await expect(page.locator('#status-echo')).toHaveText('vellanu');
  });

  test('writes Telugu through the engine, so the roman view reads it back', async ({ page }) => {
    await page.goto('/');
    await enableTrvk(page);
    await intoTrvk(page);
    await page.keyboard.type('manchi telugu pusthakam');
    await expect(editor(page)).toHaveText('మంచి తెలుగు పుస్తకం', { timeout: 15_000 });

    // Ordinary engine output: the split view shows its Palaka-HK like any other text.
    await page.locator('#split-toggle').click();
    await expect(page.locator('#roman .cm-content')).toHaveText('maMci telugu pustakaM');
  });

  test('leaves Palaka-HK mode exactly as it was', async ({ page }) => {
    await page.goto('/');
    await enableTrvk(page);
    await intoTrvk(page);
    await page.keyboard.type('nenu ');
    await expect(editor(page)).toHaveText('నేను ', { timeout: 10_000 });

    // Back to Palaka-HK: the keys mean what they always meant, and no correction follows.
    await page.locator('#mode-toggle').click();
    await page.locator('#mode-toggle').click();
    await expect(page.locator('#status-mode')).toHaveText('Palaka-HK');
    await editor(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type('vellanu');
    await page.waitForTimeout(500);
    expect(await text(page)).toBe('నేను వెల్లను');
  });

  test('asks nothing of any other origin', async ({ page, baseURL }) => {
    const here = new URL(baseURL!).origin;
    const outside: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.origin !== here && url.protocol !== 'data:') outside.push(request.url());
    });
    await page.goto('/');
    await enableTrvk(page);
    await intoTrvk(page);
    await page.keyboard.type('nenu eeroju');
    await expect(editor(page)).toHaveText('నేను ఈరోజు', { timeout: 15_000 });
    expect(outside).toEqual([]);
  });

  test('still works offline once the model has been downloaded', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, { timeout: 30_000 });
    await enableTrvk(page);
    await intoTrvk(page);
    await page.keyboard.type('nenu');
    await expect(editor(page)).toHaveText('నేను', { timeout: 10_000 });

    // Everything TRVK needs is in the runtime cache now, so the network can go away.
    await expect
      .poll(
        () => page.evaluate(async () => (await caches.open('trvk-model')).keys().then((keys) => keys.length)),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(0);

    await context.setOffline(true);
    try {
      await page.reload();
      await intoTrvk(page);
      await clear(page);
      await page.keyboard.type('intiki');
      await expect(editor(page)).toHaveText('ఇంటికి', { timeout: 15_000 });
    } finally {
      await context.setOffline(false);
    }
  });

  test('keeps a keystroke inside its frame, and a correction inside a blink', async ({ page }) => {
    await page.goto('/');
    await enableTrvk(page);
    await intoTrvk(page);

    // Time from the keystroke to the word being rendered, over a sentence typed letter by
    // letter. The budget is a guard against a regression, not a benchmark: phase 3 measured
    // p95 12 ms from request to rendered Telugu on this class of machine.
    const samples: number[] = [];
    for (const char of 'nenu eeroju intiki vellanu') {
      const started = Date.now();
      await page.keyboard.type(char);
      samples.push(Date.now() - started);
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.ceil(0.95 * samples.length) - 1];
    expect(p95, `keystroke p95 ${p95} ms over ${samples.length} keys`).toBeLessThan(100);
    await expect(editor(page)).toHaveText('నేను ఈరోజు ఇంటికి వేళ్ళను', { timeout: 15_000 });
  });
});
