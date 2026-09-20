import { codePointsOf } from './inspect';

/** Finds what the eye cannot see in a line of text: invisible characters, marks with nothing to stand on, look-alike letters. No DOM. */

export type FindingKind = 'invisible' | 'stray' | 'foreign';

export interface Finding {
  kind: FindingKind;
  from: number;
  to: number;
  /** Short text shown in place of, or next to, the character. */
  label: string;
  /** Full explanation for the tooltip and the status bar. */
  message: string;
}

const INVISIBLE: Record<number, [label: string, name: string]> = {
  0x00a0: ['NBSP', 'no-break space'],
  0x00ad: ['SHY', 'soft hyphen'],
  0x200b: ['ZWSP', 'zero-width space'],
  0x200c: ['ZWNJ', 'zero-width non-joiner'],
  0x200d: ['ZWJ', 'zero-width joiner'],
  0x200e: ['LRM', 'left-to-right mark'],
  0x200f: ['RLM', 'right-to-left mark'],
  0x2060: ['WJ', 'word joiner'],
  0xfeff: ['BOM', 'byte order mark'],
};

const VIRAMA = 0x0c4d;
const NUKTA = 0x0c3c;
const between = (cp: number, low: number, high: number) => cp >= low && cp <= high;
const isConsonant = (cp: number) => between(cp, 0x0c15, 0x0c39) || between(cp, 0x0c58, 0x0c5a);
const isVowelLetter = (cp: number) => between(cp, 0x0c05, 0x0c14) || between(cp, 0x0c60, 0x0c61);
const isVowelSign = (cp: number) => between(cp, 0x0c3e, 0x0c4c) || between(cp, 0x0c55, 0x0c56) || between(cp, 0x0c62, 0x0c63);
const isModifier = (cp: number) => between(cp, 0x0c00, 0x0c04);

const LETTER = /\p{L}/u;
const TELUGU = /\p{Script=Telugu}/u;
const SCRIPTS = ['Kannada', 'Latin', 'Devanagari', 'Tamil', 'Malayalam', 'Cyrillic', 'Greek'] as const;
const SCRIPT_TESTS = SCRIPTS.map((name) => [name, new RegExp(`\\p{Script=${name}}`, 'u')] as const);
const scriptOf = (ch: string) => SCRIPT_TESTS.find(([, test]) => test.test(ch))?.[0] ?? 'another script';

const hex = (ch: string) => codePointsOf(ch)[0];

/** What a Telugu mark may follow. */
type Base = 'none' | 'consonant' | 'vowel' | 'sign' | 'virama' | 'modifier';

export function inspectLine(text: string): Finding[] {
  const findings: Finding[] = [];
  let base: Base = 'none';
  let wordHasTelugu = false;
  let foreign: Finding[] = [];

  const endWord = () => {
    if (wordHasTelugu) findings.push(...foreign);
    wordHasTelugu = false;
    foreign = [];
  };

  let offset = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const from = offset;
    const to = (offset += ch.length);
    const stray = (what: string) =>
      findings.push({ kind: 'stray', from, to, label: ch, message: `${hex(ch)} ${what} with nothing to stand on` });

    if (INVISIBLE[cp]) {
      const [label, name] = INVISIBLE[cp];
      findings.push({ kind: 'invisible', from, to, label, message: `${hex(ch)} ${name}` });
      // Joiners belong to the syllable; they neither end a word nor change what may follow.
      continue;
    }

    if (isConsonant(cp)) base = 'consonant';
    else if (isVowelLetter(cp)) base = 'vowel';
    else if (cp === NUKTA) {
      if (base !== 'consonant') stray('nukta');
    } else if (cp === VIRAMA) {
      if (base !== 'consonant') stray('pollu');
      base = 'virama';
    } else if (isVowelSign(cp)) {
      if (base !== 'consonant') stray('vowel sign');
      base = 'sign';
    } else if (isModifier(cp)) {
      if (base === 'none' || base === 'virama') stray('sign');
      base = 'modifier';
    } else base = 'none';

    if (LETTER.test(ch) || TELUGU.test(ch)) {
      if (TELUGU.test(ch)) wordHasTelugu = true;
      else {
        const script = scriptOf(ch);
        foreign.push({ kind: 'foreign', from, to, label: script, message: `${hex(ch)} ${script} letter inside a Telugu word` });
      }
    } else if (!/\p{M}/u.test(ch)) {
      endWord();
    }
  }
  endWord();

  return findings.sort((a, b) => a.from - b.from);
}
