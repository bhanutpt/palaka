import type { Scheme } from './scheme';
import type { ConvertOptions, SchemeEntry } from './types';

export type Token =
  | { kind: 'key'; entry: SchemeEntry; start: number; end: number }
  /** Backtick span. `text` is the content with the backticks removed; `` gives one literal backtick. */
  | { kind: 'literal'; text: string; closed: boolean; start: number; end: number }
  /** One code point that is not in the map; copied unchanged. */
  | { kind: 'raw'; text: string; start: number; end: number };

export const LITERAL_QUOTE = '`';

/** Longest key in the map that starts at `pos`, or undefined. */
export function matchKey(
  text: string,
  pos: number,
  scheme: Scheme,
  options: ConvertOptions = {},
): SchemeEntry | undefined {
  const longest = Math.min(scheme.maxKeyLength, text.length - pos);
  for (let len = longest; len >= 1; len--) {
    const entry = scheme.byKey.get(text.slice(pos, pos + len));
    if (!entry) continue;
    if (entry.type === 'digit' && !options.teluguDigits) continue;
    return entry;
  }
  return undefined;
}

export function tokenize(roman: string, scheme: Scheme, options: ConvertOptions = {}): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < roman.length) {
    if (roman[i] === LITERAL_QUOTE) {
      // A literal span runs to the closing backtick, or to the end of the line if unclosed.
      let j = i + 1;
      while (j < roman.length && roman[j] !== LITERAL_QUOTE && roman[j] !== '\n') j++;
      const closed = roman[j] === LITERAL_QUOTE;
      const content = roman.slice(i + 1, j);
      const end = closed ? j + 1 : j;
      tokens.push({
        kind: 'literal',
        text: closed && content === '' ? LITERAL_QUOTE : content,
        closed,
        start: i,
        end,
      });
      i = end;
      continue;
    }

    const entry = matchKey(roman, i, scheme, options);
    if (entry) {
      tokens.push({ kind: 'key', entry, start: i, end: i + entry.key.length });
      i += entry.key.length;
      continue;
    }

    const ch = String.fromCodePoint(roman.codePointAt(i)!);
    tokens.push({ kind: 'raw', text: ch, start: i, end: i + ch.length });
    i += ch.length;
  }
  return tokens;
}
