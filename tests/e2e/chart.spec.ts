import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { clear, editor, text } from './helpers';

interface Entry {
  key: string;
  letter: string;
  sign?: string;
  type: string;
}

const scheme = JSON.parse(readFileSync('scheme/palaka-hk.json', 'utf8')) as { entries: Entry[] };
const tile = (id: string) => `[data-tile="${id}"]`;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await editor(page).click();
});

test('every key of the mapping appears exactly once in the chart', async ({ page }) => {
  const ids = await page.locator('#chart .chart-body [data-tile]').evaluateAll((nodes) =>
    nodes.map((n) => (n as HTMLElement).dataset.tile!).filter((id) => !id.startsWith('sign:')),
  );
  expect([...ids].sort()).toEqual(scheme.entries.map((e) => e.key).sort());
});

test('the chart is in the traditional order with a 5 by 5 varga grid', async ({ page }) => {
  const sections = await page.locator('#chart [data-section]').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.section));
  expect(sections).toEqual(['vowels', 'vowel-signs', 'vargas', 'consonants', 'signs', 'rare', 'digits']);

  // Five rows of five, each row on one line and the columns aligned.
  const boxes = await page.locator('[data-section="vargas"] [data-tile]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y) };
    }),
  );
  expect(boxes).toHaveLength(25);
  expect(new Set(boxes.map((b) => b.x)).size).toBe(5);
  expect(new Set(boxes.map((b) => b.y)).size).toBe(5);
});

test('clicking any tile inserts exactly its letter', async ({ page }) => {
  test.slow();
  for (const entry of scheme.entries) {
    await clear(page);
    // The two keys that output nothing are marked disabled; they must still do no harm.
    await page.locator(tile(entry.key)).click({ force: entry.letter === '' });
    expect(await text(page), `tile ${entry.key}`).toBe(entry.letter);
  }
  for (const entry of scheme.entries.filter((e) => e.sign)) {
    await clear(page);
    await page.locator(tile('k')).click();
    await page.locator(tile(`sign:${entry.key}`)).click();
    expect(await text(page), `sign tile ${entry.key}`).toBe('క' + entry.sign);
  }
});

test('a click inserts at the cursor and the editor keeps the focus', async ({ page }) => {
  await page.keyboard.type('pa ka');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.locator(tile('l')).click();
  await page.keyboard.type('ka');
  expect(await text(page)).toBe('పలక క');
});

test('the tile of the key just typed lights up', async ({ page }) => {
  await page.keyboard.type('k');
  await expect(page.locator(tile('k'))).toHaveClass(/is-typed/);
  await page.keyboard.type('h');
  await expect(page.locator(tile('kh'))).toHaveClass(/is-typed/);
  await expect(page.locator(tile('k'))).not.toHaveClass(/is-typed/);
  await page.keyboard.type('A');
  await expect(page.locator(tile('sign:A'))).toHaveClass(/is-typed/);
  await expect(page.locator(tile('A'))).not.toHaveClass(/is-typed/);
  await page.keyboard.type(' ');
  await expect(page.locator('.is-typed')).toHaveCount(0);
  await page.keyboard.type('A');
  await expect(page.locator(tile('A'))).toHaveClass(/is-typed/);
});

test('the lit tile is scrolled into view', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 420 });
  await expect(page.locator(tile('nx'))).not.toBeInViewport();
  await page.keyboard.type('nx');
  await expect(page.locator(tile('nx'))).toBeInViewport();
});

test('the cursor highlights the tiles of its syllable and the status bar explains it', async ({ page }) => {
  await page.keyboard.type('kRSNa ');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator(tile('S'))).toHaveClass(/is-cursor/);
  await expect(page.locator(tile('N'))).toHaveClass(/is-cursor/);
  await expect(page.locator('.is-cursor')).toHaveCount(2);
  await expect(page.locator('#status-cursor')).toHaveText(/ష్ణ\s+SNa\s+U\+0C37 U\+0C4D U\+0C23/);

  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(tile('k'))).toHaveClass(/is-cursor/);
  await expect(page.locator(tile('sign:R'))).toHaveClass(/is-cursor/);
  await expect(page.locator('#status-cursor')).toHaveText(/కృ\s+kR\s+U\+0C15 U\+0C43/);
});

test('a consonant tile opens its guninta, and a choice replaces the letter just inserted', async ({ page }) => {
  await expect(page.locator('.chart-guninta')).toBeHidden();
  await page.locator(tile('k')).click();
  await expect(page.locator('.chart-guninta')).toBeVisible();
  await expect(page.locator('.chart-guninta .tile')).toHaveCount(20);
  await expect(page.locator('.chart-guninta [data-roman="kI"] .tile-letter')).toHaveText('కీ');

  await page.locator('.chart-guninta [data-roman="kI"]').click();
  expect(await text(page)).toBe('కీ');
  await page.locator('.chart-guninta [data-roman="kU"]').click();
  expect(await text(page)).toBe('కూ');

  // After typing, a guninta choice is a plain insertion again.
  await page.keyboard.type(' ');
  await page.locator('.chart-guninta [data-roman="k"]').click();
  expect(await text(page)).toBe('కూ క్');

  await page.locator('.guninta-close').click();
  await expect(page.locator('.chart-guninta')).toBeHidden();
});

test('the guninta spells forms that need the break key', async ({ page }) => {
  await page.locator(tile('l')).click();
  await expect(page.locator('.chart-guninta [data-roman="l_R"] .tile-letter')).toHaveText('లృ');
});

test('search dims everything that does not match', async ({ page }) => {
  await page.locator('.chart-search').fill('kh');
  await expect(page.locator('#chart .chart-body .tile:not(.is-dimmed)')).toHaveCount(1);
  await expect(page.locator(tile('kh'))).not.toHaveClass(/is-dimmed/);

  await page.locator('.chart-search').fill('ఱ');
  await expect(page.locator('#chart .chart-body .tile:not(.is-dimmed)')).toHaveCount(1);
  await expect(page.locator(tile('rx'))).not.toHaveClass(/is-dimmed/);

  await page.locator('.chart-search').fill('');
  await expect(page.locator('.is-dimmed')).toHaveCount(0);
});

test('the chart can be used from the keyboard', async ({ page }) => {
  await page.locator(tile('k')).focus();
  await page.keyboard.press('Enter');
  expect(await text(page)).toBe('క');
  await expect(page.locator(tile('k'))).toBeFocused();
  await expect(page.locator(tile('k'))).toHaveAttribute('aria-label', 'క, key k');
});

test('the chart collapses and comes back', async ({ page }) => {
  await page.locator('#chart-toggle').click();
  await expect(page.locator('#chart')).toBeHidden();
  await expect(page.locator('#chart-toggle')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#chart-toggle').click();
  await expect(page.locator('#chart')).toBeVisible();
});

test('the status bar counts characters and words', async ({ page }) => {
  await page.keyboard.type('palaka telugu');
  await expect(page.locator('#status-counts')).toHaveText('10 characters · 2 words');
});

test('the status bar warns about Caps Lock', async ({ page }) => {
  // The real Caps Lock state cannot be driven from a test, so the key events carry it.
  const press = (capsLock: boolean) =>
    editor(page).evaluate((el, on) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', modifierCapsLock: on, bubbles: true }));
    }, capsLock);

  await press(true);
  await expect(page.locator('#status-warning')).toHaveText('Caps Lock is on');
  await press(false);
  await expect(page.locator('#status-warning')).toBeEmpty();
});
