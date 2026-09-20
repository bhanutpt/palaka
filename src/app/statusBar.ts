import { toRoman } from '../engine';
import type { EditorStatus } from '../editor/createEditor';
import { codePointsOf } from '../editor/inspect';

const COUNT_DELAY_MS = 250;
const FLASH_MS = 2000;
const ROMAN_PREVIEW = 80;

const shorten = (text: string) => {
  const line = text.replace(/\n/g, ' ');
  return line.length > ROMAN_PREVIEW ? line.slice(0, ROMAN_PREVIEW) + '…' : line;
};

export interface StatusBar {
  update(status: EditorStatus, getText: () => string): void;
  setSaved(saved: boolean): void;
  /** Shows a short message (Copied …) that fades by itself. */
  flash(message: string): void;
}

/** Character count in code points (line breaks excluded) and word count. */
export function countText(text: string): { characters: number; words: number } {
  let characters = 0;
  for (const ch of text) if (ch !== '\n') characters++;
  const words = text.split(/\s+/).filter(Boolean).length;
  return { characters, words };
}

export function createStatusBar(root: HTMLElement): StatusBar {
  const field = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
  const mode = field('status-mode');
  const echo = field('status-echo');
  const cursor = field('status-cursor');
  const counts = field('status-counts');
  const warning = field('status-warning');
  const savedField = field('status-saved');
  const message = field('status-message');
  let timer: number | undefined;
  let flashTimer: number | undefined;

  return {
    setSaved(saved) {
      savedField.textContent = saved ? 'Saved' : 'Edited';
    },
    flash(text) {
      message.textContent = text;
      window.clearTimeout(flashTimer);
      flashTimer = window.setTimeout(() => (message.textContent = ''), FLASH_MS);
    },
    update(status, getText) {
      mode.textContent = status.mode === 'telugu' ? 'Palaka-HK' : 'English';
      echo.textContent = status.echo;

      // A selection shows its roman spelling; otherwise the syllable before the cursor is explained.
      const syllable = status.syllable?.text ?? '';
      if (status.selection) cursor.textContent = shorten(toRoman(status.selection));
      else if (syllable.trim()) cursor.textContent = `${syllable}  ${toRoman(syllable)}  ${codePointsOf(syllable).join(' ')}`;
      else cursor.textContent = '';

      const warnings: string[] = [];
      if (status.capsLock && status.mode === 'telugu') warnings.push('Caps Lock is on');
      if (status.unmapped.length > 0) warnings.push(`Not a Palaka-HK key: ${status.unmapped.join(' ')}`);
      warning.textContent = warnings.join(' · ');

      // Counting reads the whole text, so it waits for a pause in typing.
      if (status.docChanged) {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          const { characters, words } = countText(getText());
          counts.textContent = `${characters} characters · ${words} words`;
        }, COUNT_DELAY_MS);
      }
    },
  };
}
