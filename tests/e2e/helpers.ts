import type { Page } from '@playwright/test';

export const editor = (page: Page) => page.locator('.cm-content');

/** The editor text, read from the rendered lines. */
export async function text(page: Page): Promise<string> {
  return (await page.locator('.cm-line').allInnerTexts()).map((line) => line.replace(/\n$/, '')).join('\n');
}

export async function clear(page: Page) {
  await editor(page).click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Delete');
}
