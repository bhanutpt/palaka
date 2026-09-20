import { convert, type ConvertOptions } from '../engine';

/** Pure logic of find and replace, which accepts Telugu or Palaka-HK roman. No DOM. */

export interface Query {
  /** The Telugu (or literal) text that is searched for. */
  needle: string;
  /**
   * The roman query ended in a bare consonant (`k`, `tel`): the pollu is left off, so that the
   * consonant matches in all its forms (క, కా, క్క …) and a replacement keeps the vowel.
   */
  open: boolean;
  /** A roman query names whole syllables: `ka` is క, not the క inside కా. */
  exact: boolean;
}

const VIRAMA = '\u0C4D';
// eslint-disable-next-line no-control-regex
const ASCII_ONLY = /^[\x00-\x7F]*$/;
/** Vowel signs and the virama: what may follow a consonant inside its syllable. */
const DEPENDENT = /^[\u0C3E-\u0C4D\u0C55\u0C56\u0C62\u0C63]/;

/**
 * Text that contains Telugu (or anything beyond ASCII) is searched as it is. ASCII text is
 * converted from Palaka-HK when `asRoman` is set, and searched literally otherwise.
 */
export function interpretQuery(query: string, asRoman: boolean, options: ConvertOptions = {}): Query {
  const literal = query.normalize('NFC');
  if (!asRoman || !ASCII_ONLY.test(query)) return { needle: literal, open: false, exact: false };

  const telugu = convert(query, options).text;
  const open = telugu.endsWith(VIRAMA) && telugu === convert(query + 'a', options).text + VIRAMA;
  return { needle: open ? telugu.slice(0, -1) : telugu, open, exact: !open && telugu !== '' };
}

/** Start offsets of all matches, left to right, without overlaps. */
export function findAll(text: string, query: Query): number[] {
  const matches: number[] = [];
  if (query.needle === '') return matches;
  let from = 0;
  for (;;) {
    const at = text.indexOf(query.needle, from);
    if (at < 0) return matches;
    const end = at + query.needle.length;
    if (query.exact && DEPENDENT.test(text.slice(end, end + 1))) {
      from = at + 1;
      continue;
    }
    matches.push(at);
    from = end;
  }
}

/** The text that replaces one match. An open query is replaced by an open consonant, so the vowel stays. */
export function replacementFor(query: Query, replacement: string, asRoman: boolean, options: ConvertOptions = {}): string {
  const result = interpretQuery(replacement, asRoman, options);
  if (query.open || !result.open) return result.needle;
  return result.needle + VIRAMA;
}
