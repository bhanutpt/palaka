import type { Page } from '@playwright/test';

export const editor = (page: Page) => page.locator('#editor .cm-content');

/** The editor text, read from the rendered lines. */
export async function text(page: Page): Promise<string> {
  return (await page.locator('#editor .cm-line').allInnerTexts()).map((line) => line.replace(/\n$/, '')).join('\n');
}

export async function clear(page: Page) {
  await editor(page).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
}

/** Pastes text through a real paste event, which is what the clean-up filter listens to. */
export async function paste(page: Page, data: string) {
  await editor(page).evaluate((el, value) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', value);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  }, data);
}
