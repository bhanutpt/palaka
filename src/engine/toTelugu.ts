import { defaultScheme, type Scheme } from './scheme';
import { tokenize } from './tokenizer';
import type { ConvertOptions } from './types';

export interface UnmappedChar {
  char: string;
  /** Offset in the roman input. */
  index: number;
}

export interface ConvertResult {
  text: string;
  /** Latin letters that are not part of any key (f, q, w, a stray x …); copied unchanged. */
  unmapped: UnmappedChar[];
  /** Offset of a backtick that was never closed on its line, or -1. */
  unclosedLiteralAt: number;
}

const LATIN_LETTER = /^[A-Za-z]$/;

/**
 * Roman to Telugu, with diagnostics.
 *
 * The only state is `pending`: a consonant has been written and nothing has
 * followed it yet. A vowel key resolves it to a vowel sign, a consonant key to
 * a conjunct through the virama, and everything else to a visible pollu. The
 * break key `_` alone leaves it untouched.
 */
export function convert(
  roman: string,
  options: ConvertOptions = {},
  scheme: Scheme = defaultScheme,
): ConvertResult {
  const out: string[] = [];
  const unmapped: UnmappedChar[] = [];
  let unclosedLiteralAt = -1;
  let pending = false;

  const closeSyllable = () => {
    if (pending) out.push(scheme.virama);
    pending = false;
  };

  for (const token of tokenize(roman, scheme, options)) {
    if (token.kind === 'literal') {
      closeSyllable();
      out.push(token.text);
      if (!token.closed && unclosedLiteralAt < 0) unclosedLiteralAt = token.start;
      continue;
    }
    if (token.kind === 'raw') {
      closeSyllable();
      out.push(token.text);
      if (LATIN_LETTER.test(token.text)) unmapped.push({ char: token.text, index: token.start });
      continue;
    }

    const entry = token.entry;
    switch (entry.type) {
      case 'consonant':
        closeSyllable();
        out.push(entry.letter);
        pending = true;
        break;
      case 'vowel':
        out.push(pending ? (entry.sign ?? '') : entry.letter);
        pending = false;
        break;
      case 'control':
        if (entry.action === 'break') break;
        closeSyllable();
        out.push(entry.letter);
        break;
      default:
        closeSyllable();
        out.push(entry.letter);
    }
  }
  closeSyllable();

  return { text: out.join('').normalize('NFC'), unmapped, unclosedLiteralAt };
}

export function toTelugu(roman: string, options: ConvertOptions = {}): string {
  return convert(roman, options).text;
}
