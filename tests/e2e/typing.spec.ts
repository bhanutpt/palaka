import { expect, test, type Page } from '@playwright/test';
import { editor, text } from './helpers';

const ZWNJ = String.fromCharCode(0x200c);

async function paste(page: Page, data: string) {
  await editor(page).evaluate((el, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, data);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await editor(page).click();
});

test('types the worked examples of the plan', async ({ page }) => {
  await page.keyboard.type('palaka telugu dEzaM kRSNa jJAnaM gurraM ceTTu sAphT^vEr');
  expect(await text(page)).toBe(`పలక తెలుగు దేశం కృష్ణ జ్ఞానం గుర్రం చెట్టు సాఫ్ట్${ZWNJ}వేర్`);
});

test('shows the syllable growing keystroke by keystroke', async ({ page }) => {
  await page.keyboard.type('k');
  expect(await text(page)).toBe('క్');
  await page.keyboard.type('h');
  expect(await text(page)).toBe('ఖ్');
  await page.keyboard.type('A');
  expect(await text(page)).toBe('ఖా');
  await expect(page.locator('#status-echo')).toHaveText('khA');
});

test('backspace removes roman keystrokes while the syllable is live', async ({ page }) => {
  await page.keyboard.type('khA');
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe('ఖ్');
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe('క్');
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe('');
});

test('backspace removes one code point once the syllable is finished', async ({ page }) => {
  await page.keyboard.type('kA ');
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe('కా');
  await page.keyboard.press('Backspace');
  expect(await text(page)).toBe('క');
});

test('a cursor move ends the syllable', async ({ page }) => {
  await page.keyboard.type('k');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('a');
  expect(await text(page)).toBe('క్అ');
});

test('typing in the middle of a line', async ({ page }) => {
  await page.keyboard.type('paka');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('la');
  expect(await text(page)).toBe('పలక');
});

test('typing in front of a letter that joins the live pollu into a conjunct', async ({ page }) => {
  await page.keyboard.type('akka');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type('sta');
  expect(await text(page)).toBe('అస్తక్క');
  await page.keyboard.press('Home');
  await page.keyboard.type('kRSNa ');
  expect(await text(page)).toBe('కృష్ణ అస్తక్క');
});

test('typing replaces the selection', async ({ page }) => {
  await page.keyboard.type('pAlu');
  await page.keyboard.press('Shift+Home');
  await page.keyboard.type('nIru');
  expect(await text(page)).toBe('నీరు');
});

test('Enter ends the syllable and starts a new line', async ({ page }) => {
  await page.keyboard.type('k');
  await page.keyboard.press('Enter');
  await page.keyboard.type('a');
  expect(await text(page)).toBe('క్\nఅ');
});

test('undo and redo work by whole syllable', async ({ page }) => {
  await page.keyboard.type('palaka');
  await page.keyboard.press('Control+z');
  expect(await text(page)).toBe('పల');
  await page.keyboard.press('Control+z');
  expect(await text(page)).toBe('ప');
  await page.keyboard.press('Control+y');
  await page.keyboard.press('Control+y');
  expect(await text(page)).toBe('పలక');
});

test('paste is normalised and ends the syllable', async ({ page }) => {
  await page.keyboard.type('k');
  // Two-part ai, a BOM and Windows line endings.
  await paste(page, `${String.fromCharCode(0xfeff)}క${String.fromCharCode(0x0c46, 0x0c56)}\r\nab`);
  await page.keyboard.type('a');
  expect(await text(page)).toBe('క్కై\nabఅ');
});

test('backtick literals type English inside Telugu', async ({ page }) => {
  await page.keyboard.type('idi `PDF file` kAdu');
  expect(await text(page)).toBe('ఇది PDF file కాదు');
});

test('the mode switch types plain English and back', async ({ page }) => {
  await page.keyboard.type('ka ');
  await page.keyboard.press('Control+Space');
  await expect(page.locator('#mode-toggle')).toHaveText(/English/);
  await page.keyboard.type('ka ');
  await page.locator('#mode-toggle').click();
  await expect(page.locator('#mode-toggle')).toHaveText(/తెలుగు/);
  await page.keyboard.type('ka');
  expect(await text(page)).toBe('క ka క');
});

test('an unmapped letter passes through and raises a warning', async ({ page }) => {
  await page.keyboard.type('kaf');
  expect(await text(page)).toBe('కf');
  await expect(page.locator('#status-warning')).toContainText('f');
  await page.keyboard.type('a');
  await expect(page.locator('#status-warning')).toBeEmpty();
});

test('the editor field disables autocapitalize, autocorrect and spellcheck', async ({ page }) => {
  await expect(editor(page)).toHaveAttribute('autocapitalize', 'off');
  await expect(editor(page)).toHaveAttribute('autocorrect', 'off');
  await expect(editor(page)).toHaveAttribute('spellcheck', 'false');
});

test('text from another input method is left alone', async ({ page }) => {
  await page.keyboard.type('k');
  await page.keyboard.insertText('తె');
  await page.keyboard.type('a');
  expect(await text(page)).toBe('క్తెఅ');
});
