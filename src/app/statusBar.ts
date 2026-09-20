import { toRoman } from '../engine';
import type { EditorStatus } from '../editor/createEditor';
import { codePointsOf } from '../editor/inspect';

const COUNT_DELAY_MS = 250;

export interface StatusBar {
  update(status: EditorStatus, getText: () => string): void;
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
  let timer: number | undefined;

  return {
    update(status, getText) {
      mode.textContent = status.mode === 'telugu' ? 'Palaka-HK' : 'English';
      echo.textContent = status.echo;

      const syllable = status.syllable?.text ?? '';
      cursor.textContent = syllable.trim()
        ? `${syllable}  ${toRoman(syllable)}  ${codePointsOf(syllable).join(' ')}`
        : '';

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
