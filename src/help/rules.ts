/** The rules of Palaka-HK in words. One text for the help page and for docs/SCHEME.md. Backticks mark keys. */
export const RULES: string[] = [
  '**Longest match first.** At each position the longest key wins: `lRR` before `lR` before `l`, `kh` before `k`, `ai` before `a`.',
  '**After a consonant**, a vowel key writes the vowel sign (nothing for `a`), a consonant key forms a conjunct through the virama, and anything else, including the end of the text, leaves a visible pollu.',
  '**Elsewhere** a vowel key writes the independent letter.',
  '`x` has no sound of its own; it only marks a variant of the key before it (`rx`, `Mx`, `Lx` …).',
  '`_` splits two keys that would otherwise merge and outputs nothing. It never changes the syllable: `l_R` is ల + ృ.',
  '`^` writes a zero-width non-joiner, keeping the pollu visible instead of forming a conjunct.',
  '`__` closes the syllable, so that a following vowel stays independent. Ordinary text never needs it.',
  'Text between backticks is copied unchanged with the backticks removed. An empty pair gives one literal backtick. A span that is not closed ends at the end of its line.',
  'Anything not in the map is copied unchanged; unmapped Latin letters (`f`, `q`, `w`, a stray `x`) raise a warning.',
];

/** Inputs for the examples table; the outputs are always computed by the engine. */
export const EXAMPLES: string[] = [
  'palaka', 'telugu', 'dEzaM', 'kRSNa', 'jJAnaM', 'gurraM', 'ceTTu', 'sAphT^vEr', 'a_i', 'k_ha', 'l_R', 'idi `PDF` kAdu',
];
