import { describe, expect, it } from 'vitest';
import { schemeData, validateScheme, type SchemeData, type SchemeEntry } from '../../src/engine';

/**
 * Independent check of the glyphs typed into palaka-hk.json: key -> code points
 * of the letter, then of the vowel sign. Written in hex on purpose, so a
 * look-alike glyph in the mapping cannot slip through.
 */
const CODE_POINTS: Record<string, string> = {
  a: '0C05', A: '0C06 0C3E', i: '0C07 0C3F', I: '0C08 0C40', u: '0C09 0C41', U: '0C0A 0C42',
  R: '0C0B 0C43', RR: '0C60 0C44', lR: '0C0C 0C62', lRR: '0C61 0C63',
  e: '0C0E 0C46', E: '0C0F 0C47', ai: '0C10 0C48', o: '0C12 0C4A', O: '0C13 0C4B', au: '0C14 0C4C',
  k: '0C15', kh: '0C16', g: '0C17', gh: '0C18', G: '0C19',
  c: '0C1A', ch: '0C1B', j: '0C1C', jh: '0C1D', J: '0C1E',
  T: '0C1F', Th: '0C20', D: '0C21', Dh: '0C22', N: '0C23',
  t: '0C24', th: '0C25', d: '0C26', dh: '0C27', n: '0C28',
  p: '0C2A', ph: '0C2B', b: '0C2C', bh: '0C2D', m: '0C2E',
  y: '0C2F', r: '0C30', l: '0C32', v: '0C35', z: '0C36', S: '0C37', s: '0C38', h: '0C39',
  L: '0C33', rx: '0C31',
  kS: '0C15 0C4D 0C37', jJ: '0C1C 0C4D 0C1E',
  M: '0C02', H: '0C03', Mx: '0C01', "'": '0C3D', '|': '0964', '||': '0965',
  '^': '200C', _: '', __: '',
  cx: '0C58', jx: '0C59', Lx: '0C34', nx: '0C5D',
  0: '0C66', 1: '0C67', 2: '0C68', 3: '0C69', 4: '0C6A',
  5: '0C6B', 6: '0C6C', 7: '0C6D', 8: '0C6E', 9: '0C6F',
};

const hex = (s: string) =>
  Array.from(s, (ch) => ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')).join(' ');

const withEntries = (change: (entries: SchemeEntry[]) => void): SchemeData => {
  const copy = structuredClone(schemeData);
  change(copy.entries);
  return copy;
};

describe('scheme/palaka-hk.json', () => {
  it('passes validation', () => {
    expect(validateScheme(schemeData)).toEqual([]);
  });

  it('has exactly the keys in the code point table', () => {
    expect(schemeData.entries.map((e) => e.key).sort()).toEqual(Object.keys(CODE_POINTS).sort());
  });

  it.each(schemeData.entries)('key $key has the right code points', (entry) => {
    expect(hex(entry.letter + (entry.sign ?? ''))).toBe(CODE_POINTS[entry.key]);
  });

  it('uses U+0C4D as the virama', () => {
    expect(hex(schemeData.virama)).toBe('0C4D');
  });
});

describe('validateScheme catches broken mappings', () => {
  it('key collision', () => {
    const bad = withEntries((e) => e.push({ ...e.find((x) => x.key === 'k')!, letter: 'ౚ', order: 99 }));
    expect(validateScheme(bad).join('\n')).toMatch(/key collision: "k"/);
  });

  it('letter with two canonical keys', () => {
    const bad = withEntries((e) => e.push({ ...e.find((x) => x.key === 'ph')!, key: 'f', order: 99 }));
    expect(validateScheme(bad).join('\n')).toMatch(/two canonical keys: "ph" and "f"/);
  });

  it('x anywhere but the end of a key', () => {
    const bad = withEntries((e) => e.push({ ...e.find((x) => x.key === 'rx')!, key: 'xr', letter: 'ౚ', order: 99 }));
    expect(validateScheme(bad).join('\n')).toMatch(/"x" may only be the final character/);
  });

  it('group missing from the chart', () => {
    const bad = withEntries((e) => {
      (e[0] as { group: string }).group = 'nowhere';
    });
    expect(validateScheme(bad).join('\n')).toMatch(/is not in the chart/);
  });

  it('entry that breaks the round trip', () => {
    // A two-code-point "letter" cannot be read back as one key.
    const bad = withEntries((e) => e.push({ key: 'q', letter: 'కక', type: 'symbol', group: 'rare', order: 99 }));
    expect(validateScheme(bad).join('\n')).toMatch(/entry "q"/);
  });
});
