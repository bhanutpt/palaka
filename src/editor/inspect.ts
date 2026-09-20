/** Finds the written syllable next to the cursor, for the chart highlight and the status bar. No DOM. */

export interface Syllable {
  text: string;
  from: number;
  to: number;
}

const VIRAMA = 0x0c4d;
const NUKTA = 0x0c3c;
const ZWNJ = 0x200c;
const ZWJ = 0x200d;

const between = (cp: number, low: number, high: number) => cp >= low && cp <= high;
const isConsonant = (cp: number) => between(cp, 0x0c15, 0x0c39) || between(cp, 0x0c58, 0x0c5a);
const isVowelLetter = (cp: number) => between(cp, 0x0c05, 0x0c14) || between(cp, 0x0c60, 0x0c61);
const isVowelSign = (cp: number) => between(cp, 0x0c3e, 0x0c4c) || between(cp, 0x0c55, 0x0c56) || between(cp, 0x0c62, 0x0c63);
const isModifier = (cp: number) => between(cp, 0x0c00, 0x0c04);
const isTelugu = (cp: number) => between(cp, 0x0c00, 0x0c7f) || cp === ZWNJ || cp === ZWJ;

/** How far back a scan may start; no syllable is anywhere near this long. */
const LOOK_BACK = 64;

/** End offset of the syllable that starts at `i`. */
function syllableEnd(text: string, i: number): number {
  const at = (pos: number) => text.codePointAt(pos) ?? -1;
  const first = at(i);
  let pos = i + (first > 0xffff ? 2 : 1);

  if (isConsonant(first)) {
    for (;;) {
      if (at(pos) === NUKTA) pos++;
      if (at(pos) !== VIRAMA) break;
      pos++;
      // A pollu followed by ZWNJ is a deliberate break; ZWJ still joins.
      if (at(pos) === ZWNJ) return pos + 1;
      const next = at(pos) === ZWJ ? pos + 1 : pos;
      if (!isConsonant(at(next))) return next;
      pos = next + 1;
    }
    if (isVowelSign(at(pos))) pos++;
  } else if (!isVowelLetter(first)) {
    return pos;
  }
  while (isModifier(at(pos))) pos++;
  return pos;
}

/**
 * The syllable that ends at, or contains, the character before `offset` in one line of text.
 * Null at the start of the line.
 */
export function syllableBefore(line: string, offset: number): Syllable | null {
  if (offset <= 0 || offset > line.length) return null;

  // Start scanning at a safe boundary: just after the nearest non-Telugu character.
  let start = offset - 1;
  const floor = Math.max(0, offset - LOOK_BACK);
  while (start > floor && isTelugu(line.codePointAt(start - 1) ?? -1)) start--;
  // Never start on the second half of a surrogate pair.
  if (start > 0 && between(line.charCodeAt(start), 0xdc00, 0xdfff)) start--;

  for (let from = start; from < offset; ) {
    const to = syllableEnd(line, from);
    if (to >= offset) return { text: line.slice(from, to), from, to };
    from = to;
  }
  return null;
}

export function codePointsOf(text: string): string[] {
  return Array.from(text, (ch) => 'U+' + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'));
}
