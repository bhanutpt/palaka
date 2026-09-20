import { defaultScheme, type Scheme } from './scheme';
import { LITERAL_QUOTE, matchKey } from './tokenizer';
import type { ConvertOptions } from './types';

interface Piece {
  text: string;
  /** Key pieces are checked for accidental merging with what follows; others are emitted as is. */
  isKey: boolean;
}

function isPrintableAscii(ch: string): boolean {
  return ch.length === 1 && ch >= ' ' && ch <= '~';
}

/**
 * Telugu to roman. Every Telugu text has exactly one output, and
 * toTelugu(toRoman(t)) equals t for any NFC text t.
 *
 * Letters the scheme cannot express in their position (an orphan vowel sign, a
 * stray virama, ZWJ …) are copied unchanged; toTelugu passes them through the
 * same way, so the round trip still holds.
 */
export function toRoman(
  telugu: string,
  options: ConvertOptions = {},
  scheme: Scheme = defaultScheme,
): string {
  const cps = Array.from(telugu.normalize('NFC'));
  const pieces: Piece[] = [];
  const key = (text: string) => pieces.push({ text, isKey: true });
  const verbatim = (text: string) => pieces.push({ text, isKey: false });

  // Characters that toTelugu would read as keys must be wrapped in backticks.
  const needsQuoting = (ch: string) =>
    /^[A-Za-z]$/.test(ch) || scheme.keyChars.has(ch) || (!!options.teluguDigits && /^[0-9]$/.test(ch));

  let i = 0;
  while (i < cps.length) {
    const ch = cps[i];

    const consonant = scheme.consonantByLetter.get(ch);
    if (consonant) {
      key(consonant.key);
      const next = cps[i + 1];
      const vowel = next === undefined ? undefined : scheme.vowelBySign.get(next);
      if (vowel) {
        key(vowel.key);
        i += 2;
      } else if (next === scheme.virama) {
        i += 2;
        // A pollu closes by itself before anything except a vowel key, which would attach as a sign.
        if (i < cps.length && scheme.vowelByLetter.has(cps[i])) key(scheme.closeKey);
      } else {
        key(scheme.inherentKey);
        i += 1;
      }
      continue;
    }

    const mapped =
      scheme.vowelByLetter.get(ch) ??
      scheme.otherByLetter.get(ch) ??
      (options.teluguDigits ? scheme.digitByLetter.get(ch) : undefined);
    if (mapped) {
      key(mapped.key);
      i += 1;
      continue;
    }

    if (ch === LITERAL_QUOTE) {
      verbatim(LITERAL_QUOTE + LITERAL_QUOTE);
      i += 1;
      continue;
    }

    if (needsQuoting(ch)) {
      // One span covers a whole run of Latin text, inner spaces and punctuation included.
      let j = i + 1;
      while (j < cps.length && cps[j] !== LITERAL_QUOTE && isPrintableAscii(cps[j])) j++;
      while (cps[j - 1] === ' ') j--;
      verbatim(LITERAL_QUOTE + cps.slice(i, j).join('') + LITERAL_QUOTE);
      i = j;
      continue;
    }

    verbatim(ch);
    i += 1;
  }

  // Join right to left so each key is checked against the final text that follows it:
  // where the tokenizer would read a longer key (a+i as ai, k+h as kh), insert the break key.
  const parts: string[] = [];
  let lookahead = '';
  for (let p = pieces.length - 1; p >= 0; p--) {
    const piece = pieces[p];
    let text = piece.text;
    if (piece.isKey) {
      const match = matchKey(text + lookahead, 0, scheme, options);
      if (!match || match.key !== text) text += scheme.breakKey;
    }
    parts.push(text);
    lookahead = (text + lookahead).slice(0, scheme.maxKeyLength);
  }
  return parts.reverse().join('');
}
