# Changelog

## Unreleased

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
