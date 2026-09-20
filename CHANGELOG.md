# Changelog

## 1.0.0 — 2026-09-21

The first release: Palaka-HK 1.0.0 and the complete writing slate, phases 0 to 6 of docs/PLAN.md.

- The app calls itself పలక, without the exclamation mark, in its heading, its window title and its
  installed name.

### Phase 6: polish and release

- Accessibility pass. The toolbar is one Tab stop with arrow keys inside; F6 moves between the text
  and the chart; Escape in the chart closes the guninta, then goes back to the text. One focus ring
  for every control. The page language is English with `lang="te"` on all Telugu, the mode switch has
  a spoken name, and the status bar only announces warnings and messages, not every keystroke.
  axe finds no WCAG 2.1 A or AA violation in either theme, on a desktop or on a phone-sized screen,
  and a unit test holds both palettes to AA contrast.
- Phone layout: below 800 px the chart is a drawer that slides up from the bottom, closed at the
  start, with finger-sized tiles. The text always ends where the drawer begins, and tapping a tile
  leaves the on-screen keyboard down, so the chart is the keyboard. Reduced-motion is respected.
- Performance: a 100,000-character document types at one frame per key, also with the roman pane,
  the inspector and find switched on; a browser test guards the budget.
- README, with examples that a test checks against the engine. docs/SCHEME.md is now also guarded by
  a test that fails when it is out of date.
- Deployment: `.github/workflows/deploy.yml` runs the full check on every push to main and publishes
  the build to GitHub Pages. MIT licence file.
- Tests: contrast, README and scheme-document unit tests; 18 new Playwright tests.

### Phase 5: verification tools

- Split view: an editable roman pane under the text. The two stay in step line by line, in both
  directions; the roman pane keeps what was typed there and is made canonical when it loses the focus.
- Reverse conversion: a selection shows its roman spelling in the status bar; Copy roman copies the
  spelling of the selection or of the whole text.
- Text inspector: invisible characters (ZWNJ, ZWJ, ZWSP, NBSP, BOM …) appear as labels; a pollu, vowel
  sign or sign with nothing to stand on, and letters of another script inside a Telugu word (Kannada
  look-alikes, a Latin o) are marked, each with an explanation.
- Find and replace (Ctrl+F) that accepts Telugu or roman and shows the Telugu it is really looking
  for. A roman syllable matches that syllable only (`ka` is not the క in కా); a bare consonant (`k`)
  matches all its forms, and replacing it keeps the vowels (k to g turns కాకి into గాగి). Replace all
  is one undo step.
- Bulk convert: paste a block of Palaka-HK text, check the preview and the unmapped letters, insert.
- Help (F1), generated from the mapping: every key, the rules, examples computed by the engine. The
  rules text is shared with docs/SCHEME.md.
- Tests: inspector, find and help model unit tests; 11 new Playwright tests.

### Phase 4: documents and offline

- Autosave to IndexedDB after a pause in typing, with a Saved/Edited indicator. When a tab closes, the
  text also goes into a synchronous draft, which the next start picks up if it is newer than the
  stored document, so text survives a tab closed straight after typing.
- Multiple documents in a sidebar: new, switch, rename, delete (with confirmation). The title is the
  name or the first line. Each document gets its own undo history. Empty documents are never stored.
- Open `.txt` (UTF-8, cleaned up like pasted text) as a new document; Save as a UTF-8 `.txt`
  download; Copy all.
- Settings, stored in localStorage and applied at once: theme (system, light, dark), font (Noto Sans
  Telugu, Noto Serif Telugu, or an installed font by name), font size, Telugu digits, and the key of
  the Telugu/English switch (Ctrl+Space, Ctrl+., F9).
- Noto Sans Telugu and Noto Serif Telugu are bundled; the page makes no request to any other site.
- Installable offline app: web manifest, icons, and a service worker that caches the whole app.
- Browser tests now run against the production build. 10 new Playwright tests, including a closed tab
  and a reload with the network switched off.

### Phase 3: chart and status bar

- Character chart generated from the mapping in the traditional order: vowels, vowel signs, the five
  vargas as a 5 by 5 grid, other consonants, signs and controls, rare letters, digits. Every key
  appears exactly once; vowel-sign tiles are derived from the vowels.
- A tile inserts exactly what it shows. The two keys that output nothing (`_`, `__`) are shown but inert.
- The tile of the key just typed lights up and is scrolled into view (`kh` lights ఖ, `A` after a
  consonant lights the sign ా). The cursor outlines the tiles of the syllable before it.
- Guninta panel for every consonant: pollu, all vowel forms and signs, each with its canonical roman
  spelling (లృ is `l_R`). A choice replaces the letter the chart has just inserted.
- Search by roman key, Telugu letter or note; tiles that do not match are dimmed, so the layout stays put.
- Status bar: mode, live roman echo, the syllable before the cursor with its roman spelling and code
  points, character and word counts, Caps Lock and unmapped-key warnings.
- The chart collapses from the toolbar and moves under the editor on narrow screens.
- Tests: chart model and syllable inspector unit tests, 14 Playwright chart tests (every tile is clicked).

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
