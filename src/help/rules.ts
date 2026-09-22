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

/** TRVK mode in words, for the help page. It is off until the writer turns it on. */
export const TRVK_NOTES: string[] = [
  '**TRVK** (తెలుగు రోమన్ వ్యావహారిక క్రమం) is the loose roman spelling people actually type: `nenu eeroju intiki vellanu`. Switch the mode on in the settings and the typing switch gains a third position between Telugu and English.',
  'In that mode a small model on this device reads what you type and writes **Palaka-HK** for it, which the usual engine turns into Telugu. Nothing is guessed about Telugu itself: every letter on screen still comes from the engine, and the roman pane reads it back as it always did.',
  'A word is corrected while you type it, and once more when the next word appears — the neighbours are what decide `kada` between కద and కడ. After that it is left alone. A word you edit yourself is never touched again.',
  'It is often wrong on names, English words and chat-style forms. That is the point of the two modes: draft loosely in TRVK, then switch to Palaka-HK and fix what is wrong key by key, with the exact behaviour this app has always had.',
  'The first switch-on downloads about 5 MB (the model and the runtime that runs it) from this site — nothing is sent anywhere, ever, and after that first download the mode works offline like the rest of the app.',
];
