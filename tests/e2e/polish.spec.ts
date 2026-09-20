import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { clear, editor, paste, text } from './helpers';

const tile = (id: string) => `[data-tile="${id}"]`;

async function expectNoViolations(page: Page, include?: string) {
  let axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) axe = axe.include(include);
  const { violations } = await axe.analyze();
  // axe does not count a contenteditable as focusable content, so it reports CodeMirror's scroller.
  // The scroller follows the cursor, which is how a keyboard user scrolls the text.
  for (const v of violations) {
    if (v.id === 'scrollable-region-focusable') v.nodes = v.nodes.filter((n) => !String(n.target.at(-1)).endsWith('.cm-scroller'));
  }
  expect(violations.filter((v) => v.nodes.length > 0).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await editor(page).click();
    await page.keyboard.type('telugu rAyaDaM');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`no WCAG A or AA violations with everything open, ${theme} theme`, async ({ page }) => {
      await page.locator('#settings-open').click();
      await page.locator('#set-theme').selectOption(theme);
      await expectNoViolations(page, '#settings');
      await page.locator('#settings-close').click();

      await page.locator('#docs-toggle').click();
      await page.locator('#find-open').click();
      await page.locator('#find-text').fill('ya');
      await page.locator('#split-toggle').click();
      await page.locator('#inspect-toggle').click();
      await page.locator(tile('k')).click();
      await expect(page.locator('.chart-guninta')).toBeVisible();
      await expectNoViolations(page);
    });
  }

  test('no violations in the help and convert dialogs', async ({ page }) => {
    await page.locator('#help-open').click();
    await expectNoViolations(page, '#help');
    await page.keyboard.press('Escape');
    await page.locator('#convert-open').click();
    await page.locator('#convert-roman').fill('nEnu q');
    await expectNoViolations(page, '#convert');
  });

  test('the status bar announces warnings and messages, not every keystroke', async ({ page }) => {
    await expect(page.locator('#status')).not.toHaveAttribute('aria-live', /.*/);
    await expect(page.locator('#status-echo')).not.toHaveAttribute('aria-live', /.*/);
    await expect(page.locator('#status-warning')).toHaveAttribute('role', 'status');
    await expect(page.locator('#status-message')).toHaveAttribute('role', 'status');
  });

  test('the toolbar is a labelled toolbar and the mode switch says what it does', async ({ page }) => {
    await expect(page.locator('#toolbar [role="toolbar"], #toolbar[role="toolbar"]')).toHaveAttribute('aria-label', /.+/);
    const mode = page.locator('#mode-toggle');
    await expect(mode).toHaveAccessibleName(/Telugu/);
    await mode.click();
    await expect(mode).toHaveAccessibleName(/English/);
  });

  test('Escape in the chart closes the guninta, then goes back to the text', async ({ page }) => {
    await page.locator(tile('k')).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.chart-guninta')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.chart-guninta')).toBeHidden();
    await expect(page.locator(tile('k'))).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editor(page)).toBeFocused();
  });

  test('F6 moves between the text and the chart', async ({ page }) => {
    await page.keyboard.press('F6');
    await expect(page.locator('.chart-search')).toBeFocused();
    await page.keyboard.press('F6');
    await expect(editor(page)).toBeFocused();
  });

  test('a dialog gives the focus back to the button that opened it', async ({ page }) => {
    await page.locator('#help-open').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#help')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#help-open')).toBeFocused();
  });

  test('every control shows a focus ring', async ({ page }) => {
    await page.locator('#find-open').click();
    for (const selector of ['#doc-new', '#find-text', '#find-next', '#find-roman', '.chart-search', tile('k')]) {
      await page.locator(selector).focus();
      // :focus-visible only matches after keyboard use.
      await page.keyboard.press('Shift');
      const outline = await page.locator(selector).evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline, selector).not.toBe('none');
    }
  });
});

test.describe('mobile drawer', () => {
  test.use({ viewport: { width: 390, height: 780 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  const handle = (page: Page) => page.locator('#chart-handle');

  test('the chart starts as a closed drawer with only its handle showing', async ({ page }) => {
    await expect(handle(page)).toBeVisible();
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(tile('k'))).toBeHidden();
    await expect(page.locator('.chart-search')).toBeHidden();
  });

  test('the handle slides the drawer up over the bottom, and the text stays visible above it', async ({ page }) => {
    await handle(page).tap();
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#chart-toggle')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(tile('a'))).toBeInViewport();

    // Wait for the slide to end before measuring.
    await expect
      .poll(async () => (await page.locator('#chart').evaluate((el) => el.getAnimations().length)) === 0)
      .toBe(true);
    const chart = (await page.locator('#chart').boundingBox())!;
    const panes = (await page.locator('#panes').boundingBox())!;
    const status = (await page.locator('#status').boundingBox())!;
    expect(panes.y + panes.height).toBeLessThanOrEqual(chart.y + 1);
    expect(chart.y + chart.height).toBeLessThanOrEqual(status.y + 1);
    expect(chart.height).toBeGreaterThan(250);
    expect(panes.height).toBeGreaterThan(150);

    await handle(page).tap();
    await expect(handle(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(tile('k'))).toBeHidden();
  });

  test('tiles type into the text from the drawer', async ({ page }) => {
    await handle(page).tap();
    await page.locator(tile('k')).tap();
    await page.locator('.chart-guninta [data-roman="kI"]').tap();
    await page.locator(tile('r')).tap();
    expect(await text(page)).toBe('కీర');
  });

  test('tiles are large enough for a finger', async ({ page }) => {
    await handle(page).tap();
    const box = (await page.locator(tile('k')).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('the page itself never scrolls, open or closed: only the text and the chart do', async ({ page }) => {
    const overflow = () =>
      page.evaluate(() => {
        const root = document.documentElement;
        return [root.scrollWidth - window.innerWidth, root.scrollHeight - window.innerHeight, window.scrollX, window.scrollY];
      });
    await editor(page).click();
    for (let line = 0; line < 30; line++) {
      await page.keyboard.type('telugu');
      await page.keyboard.press('Enter');
    }
    expect(await overflow()).toEqual([0, 0, 0, 0]);
    await expect(page.locator('#toolbar')).toBeInViewport();

    await handle(page).tap();
    await page.locator('#find-open').click();
    await page.keyboard.type('lu');
    expect(await overflow()).toEqual([0, 0, 0, 0]);
    await expect(page.locator('#toolbar')).toBeInViewport();
  });

  test('no WCAG A or AA violations on a phone', async ({ page }) => {
    await expectNoViolations(page);
    await handle(page).tap();
    await expect
      .poll(async () => (await page.locator('#chart').evaluate((el) => el.getAnimations().length)) === 0)
      .toBe(true);
    await expectNoViolations(page);
  });

  test('on a wide screen the chart is a side panel and there is no handle', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();
    await expect(handle(page)).toBeHidden();
    await expect(page.locator(tile('k'))).toBeVisible();
  });
});

test.describe('performance', () => {
  const LINE = 'తెలుగు భాష చాలా మధురమైనది, దేశ భాషలందు తెలుగు లెస్స అని శ్రీకృష్ణదేవరాయలు అన్నారు.';
  const KEYS = 'nEnu telugu rAstunnAnu ';
  // Lag becomes visible near 100 ms. The shared CI runners are slower and run the tests in parallel.
  const BUDGET_MS_PER_KEY = process.env.CI ? 100 : 50;

  async function bigDocument(page: Page): Promise<number> {
    await page.goto('/');
    await clear(page);
    const lines = Math.ceil(100_000 / LINE.length);
    await paste(page, Array.from({ length: lines }, () => LINE).join('\n'));
    await expect(page.locator('#status-counts')).toContainText('characters');
    const characters = await page.evaluate(() => document.querySelector('#editor .cm-content')!.textContent!.length);
    expect(characters).toBeGreaterThan(0);
    return lines;
  }

  /** Types in the page and waits for a painted frame after every key, as a writer would see it. */
  async function msPerKey(page: Page, keys: string): Promise<number> {
    const start = Date.now();
    for (const key of keys) {
      await page.keyboard.press(key === ' ' ? 'Space' : key);
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
    }
    return (Date.now() - start) / keys.length;
  }

  test('a 100,000-character document still types without lag', async ({ page }) => {
    test.slow();
    await bigDocument(page);
    await expect(page.locator('#status-counts')).toContainText(/1\d\d\d\d\d characters/);

    await page.keyboard.press('Control+End');
    const atEnd = await msPerKey(page, KEYS);
    await page.keyboard.press('Control+Home');
    const atStart = await msPerKey(page, KEYS);
    console.log(`100k document: ${atEnd.toFixed(1)} ms/key at the end, ${atStart.toFixed(1)} ms/key at the start`);
    expect(atEnd).toBeLessThan(BUDGET_MS_PER_KEY);
    expect(atStart).toBeLessThan(BUDGET_MS_PER_KEY);
    expect((await text(page)).startsWith('నేను తెలుగు రాస్తున్నాను ')).toBe(true);
  });

  test('… also with the roman pane, the inspector and find all switched on', async ({ page }) => {
    test.slow();
    await bigDocument(page);
    await page.locator('#split-toggle').click();
    await page.locator('#inspect-toggle').click();
    await page.locator('#find-open').click();
    await page.locator('#find-text').fill('telugu');
    await expect(page.locator('#find-count')).toContainText('found');

    await editor(page).click();
    await page.keyboard.press('Control+Home');
    const perKey = await msPerKey(page, KEYS);
    console.log(`100k document with all tools on: ${perKey.toFixed(1)} ms/key`);
    expect(perKey).toBeLessThan(BUDGET_MS_PER_KEY * 2);
  });
});
