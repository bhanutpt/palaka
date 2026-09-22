/**
 * The vocabulary and the label decode: the TypeScript side of the TRVK model's
 * `src/trvk/models/vocab.py` and the `decode` of `src/trvk/data/windows.py`.
 *
 * Pure: no DOM, no ONNX Runtime. `tests/trvk/tokens.test.ts` checks it against the character
 * ids and decoded words that Python's onnxruntime recorded in `fixtures/parity.json`.
 */

/** Marks the start of the word being corrected inside the window text. */
export const TGT_OPEN = '';
/** Marks its end. */
export const TGT_CLOSE = '';

/** The character keeps itself. */
export const SELF = '<self>';
/** The character is absorbed into the one before it (`ee` → `I` labels the second `e`). */
export const CONT = '<cont>';
/** The character belongs to a word that stays in Latin; the decode puts it in backticks. */
export const LIT = '<lit>';

export const PAD_ID = 0;
export const UNK_CHAR_ID = 1;

export interface VocabData {
  chars: string[];
  labels: string[];
  max_len?: number;
}

export class Vocab {
  readonly chars: string[];
  readonly labels: string[];
  readonly maxLen: number;
  private readonly charIndex: Map<string, number>;

  constructor(data: VocabData) {
    this.chars = data.chars;
    this.labels = data.labels;
    this.maxLen = data.max_len ?? 96;
    this.charIndex = new Map(data.chars.map((char, index) => [char, index]));
  }

  /** Character ids, unknown characters as <unk>, truncated to the exported window length. */
  encodeText(text: string): number[] {
    const n = Math.min(text.length, this.maxLen);
    const out = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      const id = this.charIndex.get(text[i]);
      out[i] = id === undefined ? UNK_CHAR_ID : id;
    }
    return out;
  }

  decodeLabels(ids: ArrayLike<number>): string[] {
    return Array.from(ids, (id) => this.labels[id]);
  }
}

function flushLiteral(out: string[], literal: string[]): void {
  const text = literal.join('');
  // A lone backtick is written `` in Palaka-HK; anything else goes inside a pair.
  out.push(text === '`' ? '``' : '`' + text + '`');
}

/** Labels back to Palaka-HK. The target markers are skipped whatever their label. */
export function decode(text: string, labels: readonly string[]): string {
  if (text.length !== labels.length) {
    throw new Error(`${text.length} characters but ${labels.length} labels`);
  }
  const out: string[] = [];
  let literal: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const label = labels[i];
    if (char === TGT_OPEN || char === TGT_CLOSE) continue;
    if (label === LIT) {
      literal.push(char);
      continue;
    }
    if (literal.length > 0) {
      flushLiteral(out, literal);
      literal = [];
    }
    if (label === SELF) out.push(char);
    else if (label === CONT) continue;
    else out.push(label);
  }
  if (literal.length > 0) flushLiteral(out, literal);
  return out.join('');
}

/** Character positions [start, end) of the marked word inside the window text. */
export function targetSpan(text: string): [number, number] {
  const open = text.indexOf(TGT_OPEN);
  if (open < 0) return [0, text.length];
  const close = text.indexOf(TGT_CLOSE, open + 1);
  return [open + 1, close >= 0 ? close : text.length];
}

/**
 * The Palaka-HK of the marked word. Labels missing because the window was cut at max_len
 * count as <self>, exactly as in Python.
 */
export function targetOf(text: string, labels: readonly string[]): string {
  const full = labels.slice(0, text.length);
  while (full.length < text.length) full.push(SELF);
  const [start, end] = targetSpan(text);
  return decode(text.slice(start, end), full.slice(start, end));
}
