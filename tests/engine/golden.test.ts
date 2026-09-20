import { describe, expect, it } from 'vitest';
import { schemeData, toRoman, toTelugu } from '../../src/engine';
import { loadGolden } from '../golden/load';

const words = loadGolden('words.tsv');
const forwardOnly = loadGolden('forward-only.tsv');

describe('golden word list', () => {
  it('has at least 300 pairs', () => {
    expect(words.length).toBeGreaterThanOrEqual(300);
  });

  it('has no duplicate roman entries', () => {
    const seen = new Set<string>();
    for (const { roman, line } of words) {
      expect(seen.has(roman), `words.tsv:${line}: "${roman}" is listed twice`).toBe(false);
      seen.add(roman);
    }
  });

  it.each(words)('words.tsv:$line  $roman -> $telugu', ({ roman, telugu }) => {
    expect(toTelugu(roman)).toBe(telugu);
  });

  it.each(words)('words.tsv:$line  $telugu -> $roman', ({ roman, telugu }) => {
    expect(toRoman(telugu)).toBe(roman);
  });

  it.each(forwardOnly)('forward-only.tsv:$line  $roman -> $telugu', ({ roman, telugu }) => {
    expect(toTelugu(roman)).toBe(telugu);
  });

  it('uses every key in the mapping', () => {
    const all = words.map((w) => w.roman).join(' ');
    for (const entry of schemeData.entries) {
      if (entry.type === 'digit' || entry.action === 'close') continue;
      expect(all.includes(entry.key), `key "${entry.key}" never appears in words.tsv`).toBe(true);
    }
  });

  it('puts every vowel sign on at least one consonant', () => {
    const all = words.map((w) => w.telugu).join(' ');
    for (const entry of schemeData.entries) {
      if (entry.type !== 'vowel' || !entry.sign) continue;
      expect(all.includes(entry.sign), `sign of "${entry.key}" never appears in words.tsv`).toBe(true);
    }
  });
});
