/**
 * The rule table: loose roman to Palaka-HK with no model at all. It renders a word the
 * instant it is typed, so the screen never lags behind the fingers, and it is what TRVK mode
 * falls back to while the model is still downloading.
 *
 * The TypeScript side of `RuleTable` in the TRVK repo's `src/trvk/eval/baselines.py`; the
 * substitutions and their order are the same, and `tests/trvk/naive.test.ts` checks 400
 * tokens recorded from Python.
 */

const CORE = /^([^A-Za-z`]*)([\s\S]*?)([^A-Za-z`]*)$/;

const SUBS: [RegExp, string][] = [
  [/chh/g, 'ch'],
  [/ch/g, 'c'],
  [/ksh/g, 'kS'],
  [/x/g, 'kS'],
  [/sh/g, 'S'],
  [/aa/g, 'A'],
  [/ee/g, 'I'],
  [/oo/g, 'U'],
  [/ou/g, 'au'],
  [/w/g, 'v'],
  [/f/g, 'ph'],
  [/m$/g, 'M'],
  [/n(?=[kgcjtdTD])/g, 'M'],
  [/m(?=[pb])/g, 'M'],
];

/** Leading and trailing punctuation split off the word, as in Python's `split_core`. */
export function splitCore(token: string): [string, string, string] {
  const match = CORE.exec(token)!;
  return [match[1], match[2], match[3]];
}

export function naiveCore(core: string): string {
  let text = core.toLowerCase();
  for (const [pattern, replacement] of SUBS) text = text.replace(pattern, replacement);
  return text;
}

/** Palaka-HK for one loose roman token, punctuation left where it was. */
export function naive(token: string): string {
  const [before, core, after] = splitCore(token);
  return before + naiveCore(core) + after;
}
