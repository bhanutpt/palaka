import { describe, expect, it } from 'vitest';
import { defaultScheme, tokenize } from '../../src/engine';
import { CONT, LIT, SELF, Vocab, decode, targetOf, targetSpan, TGT_CLOSE, TGT_OPEN } from '../../src/trvk/tokens';
import { parity, vocabData } from './fixtures/load';

const vocab = new Vocab(vocabData);

describe('the vocabulary', () => {
  it('matches the bundle the fixture was recorded from', () => {
    expect(vocab.labels.length).toBe(parity.bundle.n_labels);
    expect(vocab.maxLen).toBe(parity.bundle.max_len);
  });

  it('encodes every recorded window exactly as Python did', () => {
    for (const window of parity.windows) {
      expect(vocab.encodeText(window.text), window.text).toEqual(window.char_ids);
    }
  });

  it('gives unknown characters the <unk> id', () => {
    expect(vocab.encodeText('అ')).toEqual([1]);
  });

  it('truncates to the window length the model was exported with', () => {
    expect(vocab.encodeText('a'.repeat(200))).toHaveLength(vocab.maxLen);
  });
});

describe('decoding labels back to Palaka-HK', () => {
  it('reproduces the Palaka-HK Python decoded for all 700 windows', () => {
    for (const window of parity.windows) {
      const labels = vocab.decodeLabels(window.label_ids);
      expect(targetOf(window.text, labels), window.text).toBe(window.target);
    }
  });

  it('keeps a character under <self> and drops one under <cont>', () => {
    expect(decode('aa', [SELF, CONT])).toBe('a');
  });

  it('wraps a run of literal characters in backticks', () => {
    expect(decode('bjp', [LIT, LIT, LIT])).toBe('`bjp`');
  });

  it('skips the target markers whatever their label', () => {
    expect(decode(`${TGT_OPEN}a${TGT_CLOSE}`, [SELF, 'A', SELF])).toBe('A');
  });

  it('refuses a label row that does not match the text', () => {
    expect(() => decode('abc', [SELF])).toThrow();
  });

  it('finds the target span, and the whole text when there is no marker', () => {
    expect(targetSpan(`ab ${TGT_OPEN}cd${TGT_CLOSE} ef`)).toEqual([4, 6]);
    expect(targetSpan('abc')).toEqual([0, 3]);
  });

  it('treats missing labels as <self>, as a window cut at max_len does', () => {
    expect(targetOf(`${TGT_OPEN}abc${TGT_CLOSE}`, [SELF, 'A'])).toBe('Abc');
  });
});

describe('the label set', () => {
  // The integration plan's property: a label is a piece of Palaka-HK. Punctuation a label
  // carries (a danda, a hyphen) passes through the engine as it always has; a Latin letter
  // that is not part of a key would not, and the model must never be able to emit one.
  const markers = new Set([SELF, CONT, LIT, '<unk>']);

  it('contains only marker labels and Palaka-HK keys, with no stray Latin letters', () => {
    for (const label of vocab.labels) {
      if (markers.has(label)) continue;
      for (const token of tokenize(label, defaultScheme)) {
        if (token.kind === 'key') continue;
        expect(token.kind, `label ${JSON.stringify(label)}`).toBe('raw');
        expect(token.kind === 'raw' && /[A-Za-z]/.test(token.text), `label ${JSON.stringify(label)}`).toBe(false);
      }
    }
  });
});
