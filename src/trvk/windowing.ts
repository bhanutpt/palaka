/**
 * Cutting the window the model sees around one word: the TypeScript side of `cut_window` in
 * the TRVK repo's `src/trvk/eval/tagger.py`, which cuts exactly as the training windows were
 * cut — context shrunk, longest side first, until the window fits.
 *
 * Pure. `tests/trvk/windowing.test.ts` checks it against 100 cuts recorded from Python.
 */

import { TGT_CLOSE, TGT_OPEN } from './tokens';

/** The window length the model was exported with. */
export const MAX_CHARS = 96;

export interface Window {
  /** The window text, with the word being corrected between the two markers. */
  text: string;
  nLeft: number;
  nRight: number;
}

export interface WindowOptions {
  maxLeft?: number;
  maxRight?: number;
  maxChars?: number;
}

export function cutWindow(words: readonly string[], k: number, options: WindowOptions = {}): Window {
  const { maxLeft = 3, maxRight = 3, maxChars = MAX_CHARS } = options;
  let nLeft = Math.min(maxLeft, k);
  let nRight = Math.min(maxRight, words.length - 1 - k);
  let left: readonly string[];
  let right: readonly string[];
  for (;;) {
    left = words.slice(k - nLeft, k);
    right = words.slice(k + 1, k + 1 + nRight);
    const chars = [...left, words[k], ...right].reduce((n, word) => n + word.length, 0);
    // The two markers and one space before each context word.
    const total = chars + left.length + right.length + 2;
    if (total <= maxChars || (nLeft === 0 && nRight === 0)) break;
    if (nLeft >= nRight) nLeft -= 1;
    else nRight -= 1;
  }
  const text = [...left, TGT_OPEN + words[k] + TGT_CLOSE, ...right].join(' ');
  return { text, nLeft, nRight };
}

/** A word of the typed line and the positions it occupies in it. */
export interface LineWord {
  raw: string;
  start: number;
  end: number;
}

/** Words of a raw line with their positions, so a correction can be written back. */
export function splitWords(line: string): LineWord[] {
  const out: LineWord[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    out.push({ raw: match[0], start: match.index, end: match.index + match[0].length });
  }
  return out;
}

/**
 * Index of the word the caret sits in. With `insideOnly` a caret in whitespace gives -1
 * ("no word is being typed", which is what a boundary keystroke means); otherwise the last
 * word is returned. -1 when the line holds no words.
 */
export function wordAtCaret(
  words: readonly LineWord[],
  caret: number,
  { insideOnly = false }: { insideOnly?: boolean } = {},
): number {
  for (let i = words.length - 1; i >= 0; i--) {
    if (words[i].start <= caret && caret <= words[i].end) return i;
  }
  return insideOnly ? -1 : words.length - 1;
}
