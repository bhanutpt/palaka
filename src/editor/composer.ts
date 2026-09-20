import { convert, defaultScheme, tokenize, type ConvertOptions, type Token } from '../engine';

/**
 * The syllable in progress: the roman keys typed so far and the Telugu they
 * currently render to. Pure logic, no DOM; the CodeMirror adapter owns the
 * position of the rendered text in the document.
 */
export interface Composition {
  roman: string;
  rendered: string;
}

export interface TypeResult {
  /** Text that is now final; it stays in the document before the live syllable. */
  committed: string;
  /** The syllable still in progress, or null when the keystroke ended it. */
  composition: Composition | null;
  /** Unmapped Latin letters in this keystroke, for the status bar. */
  unmapped: string[];
}

const isConsonant = (token: Token) => token.kind === 'key' && token.entry.type === 'consonant';
const isBreak = (token: Token) => token.kind === 'key' && token.entry.action === 'break';

const render = (roman: string, options: ConvertOptions): Composition => ({
  roman,
  rendered: convert(roman, options).text,
});

/**
 * Adds one typed character to the syllable in progress.
 *
 * The buffer holds everything that a later key could still change: `k` may
 * become `kh`, `a` may become `ai`, `M` may become `Mx`. A consonant typed
 * when no earlier consonant is still waiting for its vowel cannot affect what
 * came before it, so the buffer is cut there. A character outside the map (space,
 * punctuation, an unmapped letter) and a closing backtick end the buffer.
 */
export function typeChar(
  current: Composition | null,
  char: string,
  options: ConvertOptions = {},
): TypeResult {
  const roman = (current?.roman ?? '') + char;
  const tokens = tokenize(roman, defaultScheme, options);
  const last = tokens[tokens.length - 1];
  const previous = tokens[tokens.length - 2];

  if (last.kind === 'raw' || (last.kind === 'literal' && last.closed)) {
    const result = convert(roman, options);
    return { committed: result.text, composition: null, unmapped: result.unmapped.map((u) => u.char) };
  }

  // The break key is transparent: a consonant before it is still waiting for its vowel.
  let before = tokens.length - 2;
  while (before >= 0 && isBreak(tokens[before])) before--;
  const open = before >= 0 && isConsonant(tokens[before]);
  const startsSyllable = isConsonant(last) && previous !== undefined && !open;

  if (startsSyllable) {
    return {
      committed: convert(roman.slice(0, last.start), options).text,
      composition: render(roman.slice(last.start), options),
      unmapped: [],
    };
  }
  return { committed: '', composition: render(roman, options), unmapped: [] };
}

/** Removes the last roman keystroke; null when the buffer is used up. */
export function backspace(current: Composition, options: ConvertOptions = {}): Composition | null {
  const roman = current.roman.slice(0, -1);
  return roman === '' ? null : render(roman, options);
}
