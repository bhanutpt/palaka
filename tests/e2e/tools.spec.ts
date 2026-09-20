import { expect, test, type Page } from '@playwright/test';
import { editor, paste, text } from './helpers';

const cp = (...codes: number[]) => String.fromCharCode(...codes);
const ZWNJ = cp(0x200c);
const ZWJ = cp(0x200d);

const roman = (page: Page) => page.locator('#roman .cm-content');
const romanText = async (page: Page) =>
  (await page.locator('#roman .cm-line').allInnerTexts()).map((line) => line.replace(/\n$/, '')).join('\n');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await editor(page).click();
});

test.describe('split roman view', () => {
  test('shows the roman source and follows the typing', async ({ page }) => {
    await page.keyboard.type('telugu');
    await page.locator('#split-toggle').click();
    await expect(page.locator('#roman')).toBeVisible();
    expect(await romanText(page)).toBe('telugu');

    await page.keyboard.type(' bhASa');
    await page.keyboard.press('Enter');
    await page.keyboard.type('a_i');
    expect(await romanText(page)).toBe('telugu bhASa\na_i');
  });

  test('editing the roman pane updates the Telugu pane', async ({ page }) => {
    await page.keyboard.type('telugu');
    await page.keyboard.press('Enter');
    await page.keyboard.type('palaka');
    await page.locator('#split-toggle').click();

    // Fix a word by its spelling: telugu -> telugulO
    await roman(page).click();
    await page.keyboard.press('Control+Home');
    await page.keyboard.press('End');
    await page.keyboard.type('lO');
    expect(await text(page)).toBe('తెలుగులో\nపలక');

    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('dEzaM');
    expect(await text(page)).toBe('తెలుగులో\nపలక\nదేశం');

    // Undo in the roman pane is carried over too.
    await page.keyboard.press('Control+z');
    expect(await text(page)).not.toContain('దేశం');
  });

  test('keeps what was typed in the roman pane, and tidies it when the pane is left', async ({ page }) => {
    await page.locator('#split-toggle').click();
    await roman(page).click();
    await page.keyboard.type('k_a');
    expect(await text(page)).toBe('క');
    expect(await romanText(page)).toBe('k_a');
    await editor(page).click();
    expect(await romanText(page)).toBe('ka');
  });

  test('the roman edits are autosaved like any other', async ({ page }) => {
    await page.locator('#split-toggle').click();
    await roman(page).click();
    await page.keyboard.type('palaka');
    await expect(page.locator('#status-saved')).toHaveText('Saved');
    await page.reload();
    expect(await text(page)).toBe('పలక');
  });
});

test.describe('reverse conversion', () => {
  test('a selection shows its roman spelling, and Copy roman copies it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.keyboard.type('kRSNa jJAnaM');
    await page.keyboard.press('Shift+Home');
    await expect(page.locator('#status-cursor')).toHaveText('kRSNa jJAnaM');

    await page.locator('#copy-roman').click();
    await expect(page.locator('#status-message')).toHaveText('Roman copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('kRSNa jJAnaM');
  });
});

test.describe('text inspector', () => {
  test('pasted faulty text shows its hidden characters', async ({ page }) => {
    const kannadaKa = cp(0x0c95);
    const strayVirama = cp(0x0c4d);
    await paste(page, `సాఫ్ట్${ZWNJ}వేర్ క్${ZWJ}ష అ${strayVirama} తెలు${kannadaKa}`);

    await expect(page.locator('.insp-char')).toHaveCount(0);
    await page.locator('#inspect-toggle').click();
    await expect(page.locator('#inspect-toggle')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#editor .insp-char')).toHaveText(['ZWNJ', 'ZWJ']);
    await expect(page.locator('#editor .insp-char').first()).toHaveAttribute('title', 'U+200C zero-width non-joiner');
    await expect(page.locator('#editor .insp-stray')).toHaveCount(1);
    await expect(page.locator('#editor .insp-foreign')).toHaveAttribute('title', 'U+0C95 Kannada letter inside a Telugu word');

    // The text itself is untouched, and typing still works with the inspector on.
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' bas^lO');
    await expect(page.locator('#editor .insp-char')).toHaveText(['ZWNJ', 'ZWJ', 'ZWNJ']);
    expect(await text(page)).toContain('బస్');

    await page.locator('#inspect-toggle').click();
    await expect(page.locator('.insp-char')).toHaveCount(0);
  });
});

test.describe('find and replace', () => {
  test('finds roman or Telugu, and says what it is looking for', async ({ page }) => {
    await page.keyboard.type('kAki kOkila kaka');
    await page.keyboard.press('Control+f');
    await expect(page.locator('#find')).toBeVisible();

    await page.locator('#find-text').fill('kA');
    await expect(page.locator('#find-meaning')).toHaveText('కా');
    await expect(page.locator('#find-count')).toHaveText('1 found');
    await expect(page.locator('#editor .find-match')).toHaveCount(1);

    await page.locator('#find-text').fill('k');
    await expect(page.locator('#find-meaning')).toHaveText('క…');
    await expect(page.locator('#find-count')).toHaveText('6 found');

    await page.locator('#find-text').fill('కి');
    await expect(page.locator('#find-count')).toHaveText('2 found');
    await page.locator('#find-text').press('Enter');
    await expect(page.locator('#find-count')).toHaveText('1 of 2');
    await page.locator('#find-text').press('Enter');
    await expect(page.locator('#find-count')).toHaveText('2 of 2');

    await page.locator('#find-text').press('Escape');
    await expect(page.locator('#find')).toBeHidden();
    await expect(page.locator('.find-match')).toHaveCount(0);
  });

  test('replaces one, then all, keeping the vowels of an open consonant', async ({ page }) => {
    await page.keyboard.type('kAki kOkila');
    await page.locator('#find-open').click();
    await page.locator('#find-text').fill('k');
    await page.locator('#find-replace').fill('g');

    await page.locator('#find-next').click();
    await page.locator('#find-replace-one').click();
    expect(await text(page)).toBe('గాకి కోకిల');

    await page.locator('#find-replace-all').click();
    expect(await text(page)).toBe('గాగి గోగిల');
    await expect(page.locator('#status-message')).toHaveText('3 replaced');

    // Replace all is one undo step.
    await editor(page).click();
    await page.keyboard.press('Control+z');
    expect(await text(page)).toBe('గాకి కోకిల');
  });

  test('searches English literally when Palaka-HK is switched off', async ({ page }) => {
    await page.keyboard.type('idi `PDF` kAdu, `PDF`');
    await page.locator('#find-open').click();
    await page.locator('#find-roman').uncheck();
    await page.locator('#find-text').fill('PDF');
    await expect(page.locator('#find-count')).toHaveText('2 found');
    await expect(page.locator('#find-meaning')).toBeEmpty();
  });
});

test.describe('bulk convert', () => {
  test('previews a block of roman text and inserts it at the cursor', async ({ page }) => {
    await page.keyboard.type('modalu ');
    await page.locator('#convert-open').click();
    await page.locator('#convert-roman').fill('nEnu telugu rAstunnAnu.\nidi `PDF` kAdu wa');
    await expect(page.locator('#convert-preview')).toHaveText('నేను తెలుగు రాస్తున్నాను.\nఇది PDF కాదు wఅ');
    await expect(page.locator('#convert-warning')).toContainText('w');

    await page.locator('#convert-insert').click();
    await expect(page.locator('#convert')).toBeHidden();
    expect(await text(page)).toBe('మొదలు నేను తెలుగు రాస్తున్నాను.\nఇది PDF కాదు wఅ');
  });
});

test.describe('help', () => {
  test('lists every key with its letter, the rules and computed examples', async ({ page }) => {
    await page.keyboard.press('F1');
    await expect(page.locator('#help')).toBeVisible();
    await expect(page.locator('#help h2')).toHaveText(/Palaka-HK \d+\.\d+\.\d+/);
    await expect(page.locator('#help-body')).toContainText('sAphT^vEr');
    await expect(page.locator('#help-body')).toContainText('Longest match first');
    await expect(page.locator('#help-body tr', { hasText: 'banDi ra' })).toContainText('rx');
    await expect(page.locator('#help-body kbd').first()).toHaveText('Ctrl+Space');

    await page.locator('#help-close').click();
    await expect(page.locator('#help')).toBeHidden();
    await page.locator('#help-open').click();
    await expect(page.locator('#help')).toBeVisible();
  });
});
