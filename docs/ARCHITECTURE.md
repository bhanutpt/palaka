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
src/editor/
  composer.ts              pure: the syllable in progress, typeChar(), backspace()
  liveTyping.ts            CodeMirror extension: input handler, backspace, mode, syllable undo
  createEditor.ts          editor set-up, paste clean-up, status callback
  inspect.ts               pure: the written syllable before the cursor, code points
src/chart/
  chartModel.ts            pure: sections and tiles from the mapping, guninta, search, tile lookup
  chartPanel.ts            DOM: tiles, guninta panel, search box, highlights
src/app/
  statusBar.ts             mode, echo, cursor syllable, counts, warnings
  styles.css               (phase 4 adds documents, settings, storage)
src/help/                  phase 5: help page generated from the mapping
tests/golden/              words.tsv (both directions), forward-only.tsv
tests/engine/              golden, mapping, rule and round-trip property tests
tests/editor/              composer and inspector tests
tests/chart/               chart model tests
tests/e2e/                 Playwright typing and chart tests in a real browser
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

## Live typing

The document holds Telugu only. `composer.ts` keeps the roman keys of the syllable in progress and
re-renders that syllable through the engine on every keystroke. The buffer holds exactly what a later
key could still change; it is cut when a consonant arrives while no earlier consonant is waiting for
its vowel, and it ends on anything outside the map. A property test proves that typing keystroke by
keystroke always gives the same text as converting the whole input at once.

`liveTyping.ts` stores the live syllable and its document position in a state field. Any transaction
that is not its own (cursor move, click, paste, undo, Enter) clears the field, which is what ends the
buffer. Its edits carry an annotation that the undo history uses to group by syllable instead of by
time. When a live pollu joins the following letter into one conjunct, the browser reports the next
keystroke beyond that cluster; the position in the editor state wins.

## Chart

`chartModel.ts` turns the mapping into sections of tiles; nothing about the chart is written by hand,
so a letter added to the mapping appears in the chart, the search and the guninta by itself. A tile
inserts exactly what it shows. The editor reports the key just typed and the syllable before the
cursor through one status callback; `main.ts` passes them to the chart and the status bar, so the
chart and the editor never import each other.

## Dependency rule

`src/engine` imports nothing outside itself and the mapping file. ESLint enforces it
(`no-restricted-imports`, `no-restricted-globals`). Every other layer may import the engine.
