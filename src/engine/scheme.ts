import rawScheme from '../../scheme/palaka-hk.json';
import type { SchemeData, SchemeEntry } from './types';

/** Lookup tables compiled once from the mapping file. */
export interface Scheme {
  data: SchemeData;
  virama: string;
  /** Every key the tokenizer can match. Conjunct entries are chart-only and excluded. */
  byKey: Map<string, SchemeEntry>;
  maxKeyLength: number;
  vowelByLetter: Map<string, SchemeEntry>;
  vowelBySign: Map<string, SchemeEntry>;
  consonantByLetter: Map<string, SchemeEntry>;
  /** Signs, symbols, standalone letters and ZWNJ: one code point in, one key out. */
  otherByLetter: Map<string, SchemeEntry>;
  digitByLetter: Map<string, SchemeEntry>;
  /** Every character used in a non-digit key; such characters need backticks to stay literal. */
  keyChars: Set<string>;
  /** Key of the inherent vowel (the vowel with no sign), `a`. */
  inherentKey: string;
  /** Key of the token break control, `_`. */
  breakKey: string;
  /** Key of the syllable close control, `__`. */
  closeKey: string;
}

export function compileScheme(data: SchemeData): Scheme {
  const scheme: Scheme = {
    data,
    virama: data.virama,
    byKey: new Map(),
    maxKeyLength: 0,
    vowelByLetter: new Map(),
    vowelBySign: new Map(),
    consonantByLetter: new Map(),
    otherByLetter: new Map(),
    digitByLetter: new Map(),
    keyChars: new Set(),
    inherentKey: '',
    breakKey: '',
    closeKey: '',
  };

  for (const entry of data.entries) {
    if (entry.type !== 'digit') {
      for (const ch of entry.key) scheme.keyChars.add(ch);
    }
    if (entry.type === 'conjunct') continue;

    scheme.byKey.set(entry.key, entry);
    scheme.maxKeyLength = Math.max(scheme.maxKeyLength, entry.key.length);

    switch (entry.type) {
      case 'vowel':
        scheme.vowelByLetter.set(entry.letter, entry);
        if (entry.sign) scheme.vowelBySign.set(entry.sign, entry);
        else scheme.inherentKey = entry.key;
        break;
      case 'control':
        if (entry.action === 'break') scheme.breakKey = entry.key;
        else if (entry.action === 'close') scheme.closeKey = entry.key;
        else if (entry.letter) scheme.otherByLetter.set(entry.letter, entry);
        break;
      case 'consonant':
        scheme.consonantByLetter.set(entry.letter, entry);
        break;
      case 'digit':
        scheme.digitByLetter.set(entry.letter, entry);
        break;
      default:
        if (entry.letter) scheme.otherByLetter.set(entry.letter, entry);
    }
  }
  return scheme;
}

export const schemeData = rawScheme as SchemeData;
export const defaultScheme: Scheme = compileScheme(schemeData);
