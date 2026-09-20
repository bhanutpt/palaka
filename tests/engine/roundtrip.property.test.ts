import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { schemeData, toRoman, toTelugu, type ConvertOptions } from '../../src/engine';

const RUNS = 3000;
const OPTION_SETS: ConvertOptions[] = [{}, { teluguDigits: true }];

const vowels = schemeData.entries.filter((e) => e.type === 'vowel');
const consonants = schemeData.entries.filter((e) => e.type === 'consonant');
const others = schemeData.entries.filter((e) => !['vowel', 'consonant', 'conjunct', 'digit'].includes(e.type));
const virama = schemeData.virama;

/** Well-formed syllables: what a writer actually produces. */
const syllable = fc.oneof(
  fc.constantFrom(...vowels.map((v) => v.letter)),
  fc
    .tuple(
      fc.array(fc.constantFrom(...consonants.map((c) => c.letter)), { minLength: 1, maxLength: 4 }),
      fc.constantFrom(...vowels.map((v) => v.sign ?? ''), virama),
      fc.constantFrom('', '', '', 'ం', 'ః', 'ఁ'),
    )
    .map(([cluster, ending, sign]) => cluster.join(virama) + ending + sign),
);
const wellFormed = fc
  .array(fc.oneof({ weight: 8, arbitrary: syllable }, { weight: 1, arbitrary: fc.constantFrom(' ', '\n', ', ', '.', '\u200C', '।', '॥', '5') }), { maxLength: 30 })
  .map((parts) => parts.join(''));

/** Hostile text: any code point of the Telugu block in any order, mixed with key characters and controls. */
const teluguBlock = fc.integer({ min: 0x0c00, max: 0x0c7f }).map((cp) => String.fromCodePoint(cp));
const nasty = fc.constantFrom(
  ...'`_^|\'x aAiRlkhMH0123456789.,-\n\r\t',
  '\u200C', '\u200D', '\uFEFF', '।', '॥', 'é', '\u0301', '😀', virama,
);
const hostile = fc
  .array(fc.oneof({ weight: 5, arbitrary: teluguBlock }, { weight: 3, arbitrary: nasty }, { weight: 1, arbitrary: fc.string({ unit: 'binary', maxLength: 3 }) }), { maxLength: 40 })
  .map((parts) => parts.join('').normalize('NFC'));

/** Valid key sequences, with some free text thrown in. */
const keySequence = fc
  .array(fc.oneof({ weight: 8, arbitrary: fc.constantFrom(...schemeData.entries.map((e) => e.key)) }, { weight: 1, arbitrary: fc.constantFrom(' ', '`', 'f', 'x', '\n', '.') }), { maxLength: 40 })
  .map((keys) => keys.join(''));

describe.each(OPTION_SETS)('round trip with options %o', (options) => {
  it('toTelugu(toRoman(t)) = t for well-formed Telugu', () => {
    fc.assert(
      fc.property(wellFormed, (t) => {
        expect(toTelugu(toRoman(t, options), options)).toBe(t);
      }),
      { numRuns: RUNS },
    );
  });

  it('toTelugu(toRoman(t)) = t for any NFC text', () => {
    fc.assert(
      fc.property(hostile, (t) => {
        expect(toTelugu(toRoman(t, options), options)).toBe(t);
      }),
      { numRuns: RUNS },
    );
  });

  it('any key sequence converts, and its canonical spelling gives the same text', () => {
    fc.assert(
      fc.property(keySequence, (roman) => {
        const telugu = toTelugu(roman, options);
        const canonical = toRoman(telugu, options);
        expect(toTelugu(canonical, options)).toBe(telugu);
        // The canonical spelling is a fixed point.
        expect(toRoman(toTelugu(canonical, options), options)).toBe(canonical);
      }),
      { numRuns: RUNS },
    );
  });

  it('any string at all converts without error', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 60 }), (s) => {
        const telugu = toTelugu(s, options);
        expect(toTelugu(toRoman(telugu, options), options)).toBe(telugu);
      }),
      { numRuns: RUNS },
    );
  });
});

it('the generators cover the whole mapping', () => {
  expect(vowels.length).toBe(16);
  expect(consonants.length).toBeGreaterThanOrEqual(38);
  expect(others.length).toBeGreaterThan(0);
});
