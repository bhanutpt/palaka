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
  trvkTyping.ts            TRVK mode: the keystroke rules as pure functions, the debounce, the calls
  createEditor.ts          editor set-up, paste clean-up, status callback
  inspect.ts               pure: the written syllable before the cursor, code points
  inspector.ts             pure: invisible characters, stray signs, look-alike letters in a line
  findModel.ts             pure: query interpretation (Telugu or roman), matching, replacement
  editorTools.ts           CodeMirror side of the inspector and of find: decorations, commands
  romanPane.ts             split view: second editor mirrored line by line
src/trvk/                  TRVK mode's model; may import the engine, nothing else of the app
  tokens.ts                pure: vocabulary, character ids, the label decode back to Palaka-HK
  windowing.ts             pure: the window cut around one word, as the training data was cut
  naive.ts                 pure: the rule table that renders a word before the model answers
  ring.ts                  pure: the recent word ring, the lock rules, the stale-reply check
  protocol.ts              the messages between the page and the worker
  worker.ts                ONNX Runtime Web session, argmax, decode; one window per request
  index.ts                 TrvkModel: idle until asked, then loading, ready or unavailable
public/trvk/               the int8 model, its vocabulary and manifest; ort/ is copied at build
src/chart/
  chartModel.ts            pure: sections and tiles from the mapping, guninta, search, tile lookup
  chartPanel.ts            DOM: tiles, guninta panel, search box, highlights
src/app/
  storage.ts               IndexedDB document store; the key-value interface used for localStorage
  documents.ts             DOM-free: document list, autosave, crash draft, titles
  settings.ts              load, validate, save and apply settings; font stack
  files.ts                 open and save .txt, copy all
  sidebar.ts, settingsDialog.ts, statusBar.ts   small DOM components
  toolbar.ts               keyboard behaviour of the toolbar: one Tab stop, arrow keys inside
  styles.css               light and dark palettes as custom properties
public/                    app icons
src/help/
  rules.ts                 the rules and example inputs, shared with docs/SCHEME.md
  helpModel.ts             pure: help content built from the mapping
  helpDialog.ts            DOM
tests/golden/              words.tsv (both directions), forward-only.tsv
tests/engine/              golden, mapping, rule and round-trip property tests
tests/editor/              composer, inspector and TRVK keystroke tests
tests/trvk/                the ports against the Python fixture, the model client, real-model parity
tests/chart/               chart model tests
tests/app/                 document manager (fake-indexeddb) and settings tests
tests/e2e/                 Playwright tests in a real browser: typing, chart, documents, tools, and
                           polish (axe accessibility scans, the phone drawer, a 100,000-character text)
scripts/                   validate-scheme.ts (build gate), scheme-doc.ts and gen-scheme-doc.ts
.github/workflows/         ci.yml (branches and pull requests), deploy.yml (main: check, then GitHub Pages)
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

## Verification tools

Conversion never crosses a line break in either direction, so the Telugu text and its roman source
always have the same lines. The split view relies on that: an edit in one pane is carried over by
converting only the lines it touched, marked with an annotation so that it is not echoed back, and
kept out of the other pane's undo history.

The inspector and find follow the usual split: `inspector.ts` and `findModel.ts` are pure and unit
tested; `editorTools.ts` turns their results into CodeMirror decorations and commands.

## Documents and offline

`DocumentManager` owns the list of documents and is free of DOM code: it talks to the editor through
a two-method port and to storage through `DocumentStore` (IndexedDB) and a key-value store
(localStorage in the app, a Map in tests). Autosave is debounced. IndexedDB cannot be relied on while
a tab is closing, so `pagehide` also writes the open text to the key-value store synchronously; on the
next start a draft newer than the stored document wins.

The build is a static site. `vite-plugin-pwa` generates the manifest and a service worker that
precaches every file, fonts included, so the app starts with no network. Nothing is ever requested
from another origin; a browser test asserts that.

## Accessibility and the phone layout

The page language is English and every piece of Telugu carries `lang="te"`, so a screen reader picks
the right voice. The toolbar is one Tab stop with arrow keys inside (`toolbar.ts`); F6 moves between
the text and the chart and Escape in the chart goes back to the text. Only the warning and the
message of the status bar are live regions: the roman echo changes on every keystroke and must not
be read out. The two palettes are checked for WCAG AA contrast by a unit test that reads
`styles.css`, and axe scans the built page in both themes and at phone size.

Below 800 px the chart is a drawer. `#chart` is a grid cell as high as the visible part (the handle,
or the open drawer), so the editor always ends where the drawer begins. The drawer inside keeps its
full height and is clipped by the cell; the slide animates the height of the cell from its bottom
edge. Nothing ever overflows the page, which matters because a browser scrolls even an
`overflow: hidden` page to follow the cursor. In the drawer a tap on a tile does not move the focus
to the editor, so the on-screen keyboard stays down and the chart is the keyboard.

## Performance

Everything that runs on a keystroke works on the syllable, the line or the visible range: the
composer re-renders one syllable, the split view converts the lines an edit touched, the inspector
decorates what is on screen. Work over the whole text (counts, autosave) waits for a pause. A browser
test types into a 100,000-character document with every tool switched on and fails above a budget
per key.

## Dependency rule

`src/engine` imports nothing outside itself and the mapping file. ESLint enforces it
(`no-restricted-imports`, `no-restricted-globals`). Every other layer may import the engine.
