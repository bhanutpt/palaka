import { describe, expect, it } from 'vitest';
import { convert } from '../../src/engine';
import { naive, naiveCore, splitCore } from '../../src/trvk/naive';
import { parity } from './fixtures/load';

describe('the rule table that fills the screen before the model answers', () => {
  it('reproduces all 400 tokens the Python baseline recorded', () => {
    for (const token of parity.naive) {
      expect(naive(token.loose), token.loose).toBe(token.hk);
    }
  });

  it('applies the substitutions in the recorded order', () => {
    // The substitutions run in sequence over the whole token, so `chh` becomes `ch` and then
    // `c` like any other `ch`. The table is only the prefill; the model is what tells the two
    // apart. This is what the Python baseline does, token for token.
    expect(naiveCore('chh')).toBe('c');
    expect(naiveCore('ch')).toBe('c');
    expect(naiveCore('ksh')).toBe('kS');
    expect(naiveCore('sh')).toBe('S');
    expect(naiveCore('aa')).toBe('A');
    expect(naiveCore('ee')).toBe('I');
    expect(naiveCore('oo')).toBe('U');
  });

  it('writes an anusvara for a nasal before a stop and at the end of a word', () => {
    expect(naiveCore('dhesam')).toBe('dhesaM');
    expect(naiveCore('manchi')).toBe('maMci');
    expect(naiveCore('sambaram')).toBe('saMbaraM');
  });

  it('splits leading and trailing punctuation off the core', () => {
    expect(splitCore('"nenu,"')).toEqual(['"', 'nenu', ',"']);
    expect(splitCore('nenu')).toEqual(['', 'nenu', '']);
    expect(splitCore('...')).toEqual(['...', '', '']);
  });

  it('leaves punctuation where it was', () => {
    expect(naive('manchi.')).toBe('maMci.');
    expect(naive('(sh)')).toBe('(S)');
  });

  it('never introduces a letter the engine cannot map', () => {
    // Rule 6 in reverse: a loose word may well contain a letter outside the scheme (`q`), and
    // that letter passes through with its warning as it always has. What the prefill must not
    // do is create a new one.
    for (const token of parity.naive) {
      const typed = new Set(token.loose.toLowerCase());
      for (const unmapped of convert(naive(token.loose)).unmapped) {
        expect(typed.has(unmapped.char.toLowerCase()), `${token.loose} -> ${unmapped.char}`).toBe(true);
      }
    }
  });
});
