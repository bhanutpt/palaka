import { describe, expect, it } from 'vitest';
import { convert, normalise, toRoman, toTelugu } from '../../src/engine';

const ZWNJ = '\u200C';

describe('toTelugu: forward rules', () => {
  it('takes the longest match first', () => {
    expect(toTelugu('lRR')).toBe('ౡ');
    expect(toTelugu('lR')).toBe('ఌ');
    expect(toTelugu('kha')).toBe('ఖ');
    expect(toTelugu('ai')).toBe('ఐ');
    expect(toTelugu('rxa')).toBe('ఱ');
    expect(toTelugu('||')).toBe('॥');
  });

  it('re-renders a syllable as it grows', () => {
    expect(toTelugu('k')).toBe('క్');
    expect(toTelugu('kh')).toBe('ఖ్');
    expect(toTelugu('khA')).toBe('ఖా');
  });

  it('writes the independent vowel at the start and after a vowel or sign', () => {
    expect(toTelugu('Ai')).toBe('ఆఇ');
    expect(toTelugu('kaMa')).toBe('కంఅ');
    expect(toTelugu('ka a')).toBe('క అ');
  });

  it('closes a consonant with a pollu before anything that is not a vowel or consonant', () => {
    expect(toTelugu('k ')).toBe('క్ ');
    expect(toTelugu('k.')).toBe('క్.');
    expect(toTelugu('kM')).toBe('క్ం');
    expect(toTelugu('k\nk')).toBe('క్\nక్');
  });

  it('^ writes the pollu and a ZWNJ', () => {
    expect(toTelugu('k^v')).toBe(`క్${ZWNJ}వ్`);
    expect(toTelugu('A^')).toBe(`ఆ${ZWNJ}`);
  });

  it('_ only splits keys; it never changes the syllable', () => {
    expect(toTelugu('a_i')).toBe('అఇ');
    expect(toTelugu('k_h')).toBe('క్హ్');
    expect(toTelugu('l_R')).toBe('లృ');
    expect(toTelugu('k_a')).toBe('క');
  });

  it('__ closes the syllable', () => {
    expect(toTelugu('k__a')).toBe('క్అ');
  });

  it('leaves digits alone unless teluguDigits is set', () => {
    expect(toTelugu('2026')).toBe('2026');
    expect(toTelugu('2026', { teluguDigits: true })).toBe('౨౦౨౬');
    expect(toTelugu('`2026`', { teluguDigits: true })).toBe('2026');
  });

  it('copies literal spans without their backticks', () => {
    expect(toTelugu('`palaka`')).toBe('palaka');
    expect(toTelugu('idi `PDF` kAdu')).toBe('ఇది PDF కాదు');
    expect(toTelugu('``')).toBe('`');
  });

  it('ends an unclosed literal at the end of the line and reports it', () => {
    const result = convert('ka `abc\nka');
    expect(result.text).toBe('క abc\nక');
    expect(result.unclosedLiteralAt).toBe(3);
    expect(convert('`abc`').unclosedLiteralAt).toBe(-1);
  });

  it('passes unmapped characters through and flags the letters', () => {
    const result = convert('kafe, wiki x');
    expect(result.text).toBe('కfఎ, wఇకి x');
    expect(result.unmapped).toEqual([
      { char: 'f', index: 2 },
      { char: 'w', index: 6 },
      { char: 'x', index: 11 },
    ]);
    expect(convert('palaka 123 !?').unmapped).toEqual([]);
  });

  it('passes Telugu text through unchanged', () => {
    expect(toTelugu('తెలుగు')).toBe('తెలుగు');
  });

  it('never produces the two-part ai', () => {
    expect(toTelugu('ke\u0C56')).toBe('కై');
  });
});

describe('toRoman: reverse rules', () => {
  it('inserts _ only where keys would merge', () => {
    expect(toRoman('అఇ')).toBe('a_i');
    expect(toRoman('అఈ')).toBe('aI');
    expect(toRoman('క్హ')).toBe('k_ha');
    expect(toRoman('లృఋ')).toBe('l_R_R');
    expect(toRoman('తెలుగు')).toBe('telugu');
  });

  it('wraps Latin text and key characters in backticks', () => {
    expect(toRoman('ఇది PDF కాదు')).toBe('idi `PDF` kAdu');
    expect(toRoman('_')).toBe('`_`');
    expect(toRoman('a|b')).toBe('`a|b`');
    expect(toRoman('`')).toBe('``');
  });

  it('keeps line breaks outside literal spans', () => {
    expect(toRoman('abc\ndef')).toBe('`abc`\n`def`');
  });

  it('copies letters it cannot express in their position', () => {
    expect(toRoman('ా')).toBe('ా');
    expect(toRoman('కాి')).toBe('kAి');
    expect(toRoman('క్\u200D')).toBe('k\u200D');
  });

  it('handles Telugu digits according to the option', () => {
    expect(toRoman('౨౦౨౬')).toBe('౨౦౨౬');
    expect(toRoman('౨౦౨౬', { teluguDigits: true })).toBe('2026');
    expect(toRoman('2026', { teluguDigits: true })).toBe('`2026`');
  });

  it('normalises its input to NFC', () => {
    expect(toRoman('క\u0C46\u0C56')).toBe('kai');
  });
});

describe('normalise', () => {
  it('composes the two-part ai', () => {
    expect(normalise('క\u0C46\u0C56')).toBe('కై');
  });

  it('strips a BOM and unifies line endings', () => {
    expect(normalise('\uFEFFఅ\r\nఆ\rఇ')).toBe('అ\nఆ\nఇ');
  });
});
