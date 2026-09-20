# Changelog

## Unreleased

### Phase 2: editor

- CodeMirror 6 editor with live Palaka-HK typing: the syllable in progress is re-rendered on every
  keystroke (`k` క్, `kh` ఖ్, `khA` ఖా) and the status line echoes its roman keys.
- The buffer is cut when a new syllable starts and ends on a space, punctuation, an unmapped letter, a
  closing backtick, a cursor move, a click, Enter, a paste, undo or the mode switch.
- Backspace removes one roman keystroke while the syllable is live and one code point afterwards.
- Undo and redo work by whole syllable.
- Telugu/English mode switch (Ctrl+Space or the toolbar button); backtick literals while typing.
- Paste clean-up: NFC, BOM removal, line endings. Text from an IME or a system Telugu keyboard is
  left untouched. The field disables autocapitalize, autocorrect and spellcheck.
- Mapping validation now also requires every key to be typeable keystroke by keystroke
  (each proper prefix of a key is a key).
- Tests: composer unit and property tests (typing keystroke by keystroke equals converting the whole
  text), 16 Playwright typing tests. Playwright uses the installed Edge locally and Chromium in CI.

### Phase 1: scheme and engine

- `scheme/palaka-hk.json` version 1.0.0: vowels, consonants, signs, controls, rare letters, digits.
- Engine: longest-match tokenizer, `toTelugu`, `convert` (with unmapped-letter and unclosed-literal
  diagnostics), `toRoman` with automatic break-key insertion, `normalise`, `validateScheme`.
- Decisions taken where the plan was silent (to be confirmed at review):
  - `_` only splits keys and never ends the syllable, as the plan's example `l_R` = లృ requires.
    A new control `__` closes the syllable, so that క్అ can be written (`k__a`) and the round trip
    holds for all text.
  - An empty backtick pair gives one literal backtick.
  - An unclosed backtick span ends at the end of its line and is reported.
  - Only unmapped Latin letters raise a warning; spaces, punctuation and digits pass through silently.
- Tests: golden word list in both directions, forward-only list, mapping validation with an
  independent code point table, rule tests, fast-check round-trip properties.

### Phase 0: scaffold

- Vite and TypeScript (strict) project, ESLint with the engine purity rule, Vitest, CI workflow,
  folder layout, `CLAUDE.md`.
