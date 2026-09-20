import { describe, expect, it } from 'vitest';
import { lastKeyOf } from '../../src/editor/composer';
import { codePointsOf, syllableBefore } from '../../src/editor/inspect';

const ZWNJ = String.fromCharCode(0x200c);

describe('syllableBefore', () => {
  const at = (text: string, offset = text.length) => syllableBefore(text, offset)?.text;

  it('finds the syllable that ends at the cursor', () => {
    expect(at('పలక')).toBe('క');
    expect(at('పలక', 2)).toBe('ల');
    expect(at('కృష్ణ')).toBe('ష్ణ');
    expect(at('స్త్రీం')).toBe('స్త్రీం');
    expect(at('అఆ')).toBe('ఆ');
    expect(at('దుఃఖం', 3)).toBe('దుః');
  });

  it('keeps a final pollu and a ZWNJ with their consonant', () => {
    expect(at('బస్')).toBe('స్');
    expect(at(`సాఫ్ట్${ZWNJ}వేర్`, 7)).toBe(`ఫ్ట్${ZWNJ}`);
  });

  it('returns the whole syllable when the cursor is inside it', () => {
    expect(syllableBefore('క్క', 2)).toEqual({ text: 'క్క', from: 0, to: 3 });
  });

  it('returns single characters for everything else', () => {
    expect(at('abc')).toBe('c');
    expect(at('క 5')).toBe('5');
    expect(at('😀')).toBe('😀');
  });

  it('returns null at the start of the line', () => {
    expect(syllableBefore('పలక', 0)).toBeNull();
    expect(syllableBefore('', 0)).toBeNull();
  });

  it('works far into a long line', () => {
    const line = 'పలక '.repeat(5000);
    expect(syllableBefore(line, line.length - 1)).toEqual({ text: 'క', from: line.length - 2, to: line.length - 1 });
  });
});

describe('codePointsOf', () => {
  it('formats code points the Unicode way', () => {
    expect(codePointsOf('కా')).toEqual(['U+0C15', 'U+0C3E']);
    expect(codePointsOf('😀')).toEqual(['U+1F600']);
  });
});

describe('lastKeyOf', () => {
  it('names the key just typed and whether it wrote a vowel sign', () => {
    expect(lastKeyOf('k')).toEqual({ key: 'k', asSign: false });
    expect(lastKeyOf('kh')).toEqual({ key: 'kh', asSign: false });
    expect(lastKeyOf('khA')).toEqual({ key: 'A', asSign: true });
    expect(lastKeyOf('A')).toEqual({ key: 'A', asSign: false });
    expect(lastKeyOf('ka')).toEqual({ key: 'a', asSign: false });
    expect(lastKeyOf('k_R')).toEqual({ key: 'R', asSign: true });
    expect(lastKeyOf('kaM')).toEqual({ key: 'M', asSign: false });
  });

  it('is null when there is no key', () => {
    expect(lastKeyOf('')).toBeNull();
    expect(lastKeyOf('`ab')).toBeNull();
  });
});
