# Architecture

Palaka is a static, client-only web app: TypeScript, Vite, no server. One mapping file feeds everything.

```
scheme/palaka-hk.json      single source of truth: key, letter, sign, type, group, order, note
src/engine/                pure functions, no DOM
  types.ts                 shape of the mapping file, chart group order
  scheme.ts                compiles the mapping into lookup tables
  tokenizer.ts             longest-match tokenizer, backtick literal spans
  toTelugu.ts              convert() with diagnostics, toTelugu()
  toRoman.ts               canonical reverse conversion with break-key insertion
  normalise.ts             NFC, BOM and line-ending clean-up for pasted and opened text
  validate.ts              build-time validation of the mapping
src/editor/                phase 2: CodeMirror setup, live-typing handler, inspector
src/chart/                 phase 3: chart panel, guninta pop-up, search
src/app/                   phase 4: shell, toolbar, status bar, settings, storage
src/help/                  phase 5: help page generated from the mapping
tests/golden/              words.tsv (both directions), forward-only.tsv
tests/engine/              golden, mapping, rule and round-trip property tests
scripts/                   validate-scheme.ts (build gate), gen-scheme-doc.ts
```

## Engine

`toTelugu` tokenises by longest match and runs a one-flag state machine. The flag, *pending*, means a
consonant has been written and nothing has followed it. A vowel key resolves it to a vowel sign, a
consonant key to a virama plus the next consonant, and anything else to a visible virama. The break
key `_` is the one token that leaves the flag untouched.

`toRoman` walks the text code point by code point, emits the canonical key for each letter, and then
joins the keys from right to left. At each key it asks the tokenizer what it would read at that
position in the final string; if the answer is a longer key, it inserts `_`. Because the check uses
the real tokenizer, a new key in the mapping can never introduce an unnoticed merge.

Text the scheme cannot express in its position (an orphan vowel sign, ZWJ, an unassigned code point)
is copied as is in both directions, which is what makes the round trip hold for *any* NFC text, not
only for well-formed Telugu. Characters that `toTelugu` would read as keys are wrapped in backticks.

## Dependency rule

`src/engine` imports nothing outside itself and the mapping file. ESLint enforces it
(`no-restricted-imports`, `no-restricted-globals`). Every other layer may import the engine.
