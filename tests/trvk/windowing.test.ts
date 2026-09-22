import { describe, expect, it } from 'vitest';
import { MAX_CHARS, cutWindow, splitWords, wordAtCaret } from '../../src/trvk/windowing';
import { parity } from './fixtures/load';

describe('cutting a window around a word', () => {
  it('cuts all 100 recorded windows exactly as the training pipeline does', () => {
    for (const cut of parity.cuts) {
      const window = cutWindow(cut.words, cut.k);
      expect(window.text, cut.words.join(' ')).toBe(cut.text);
      expect(window.nLeft).toBe(cut.n_left);
      expect(window.nRight).toBe(cut.n_right);
    }
  });

  it('keeps every window within the length the model was exported with', () => {
    for (const cut of parity.cuts) expect(cutWindow(cut.words, cut.k).text.length).toBeLessThanOrEqual(MAX_CHARS);
  });

  it('drops context until the window fits, longest side first', () => {
    const long = ['a'.repeat(40), 'b'.repeat(40), 'c', 'd'.repeat(40)];
    const window = cutWindow(long, 2);
    expect(window.text.length).toBeLessThanOrEqual(MAX_CHARS);
    expect(window.nLeft + window.nRight).toBeLessThan(3);
  });

  it('keeps a single word that is longer than the window, marked', () => {
    const window = cutWindow(['x'.repeat(200)], 0);
    expect(window.nLeft).toBe(0);
    expect(window.nRight).toBe(0);
  });

  it('takes no right context when the word is last, as live typing has none', () => {
    expect(cutWindow(['nenu', 'eeroju'], 1).nRight).toBe(0);
  });
});

describe('splitting a line into words', () => {
  it('reports each word with the positions it occupies', () => {
    expect(splitWords('  nenu  intiki ')).toEqual([
      { raw: 'nenu', start: 2, end: 6 },
      { raw: 'intiki', start: 8, end: 14 },
    ]);
  });

  it('has no words in an empty or blank line', () => {
    expect(splitWords('')).toEqual([]);
    expect(splitWords('   ')).toEqual([]);
  });
});

describe('the word under the caret', () => {
  const words = splitWords('nenu intiki vellanu');

  it('is the word the caret sits in or just after', () => {
    expect(wordAtCaret(words, 0)).toBe(0);
    expect(wordAtCaret(words, 4)).toBe(0);
    expect(wordAtCaret(words, 5)).toBe(1);
    expect(wordAtCaret(words, 19)).toBe(2);
  });

  it('is nothing at all in whitespace when only the inside counts', () => {
    // A boundary keystroke means "no word is being typed": the caret sits in the space.
    expect(wordAtCaret(splitWords('nenu  intiki'), 5, { insideOnly: true })).toBe(-1);
    // Without that flag the last word is the answer, which is what a fresh caret wants.
    expect(wordAtCaret(splitWords('nenu  intiki'), 5)).toBe(1);
  });

  it('is -1 when the line holds no words', () => {
    expect(wordAtCaret([], 0)).toBe(-1);
  });
});
