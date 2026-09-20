# పలక! (Palaka)

A static, offline web app for writing Telugu. The writer types roman letters in the fixed
Palaka-HK scheme and gets exact Telugu Unicode. The full plan is in [docs/PLAN.md](docs/PLAN.md);
the scheme is in [docs/SCHEME.md](docs/SCHEME.md); the structure is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Commands

- `npm test` runs the engine and composer tests (Vitest and fast-check).
- `npm run test:e2e` runs the Playwright typing tests (installed Edge locally, Chromium in CI).
- `npm run lint`, `npm run typecheck`
- `npm run build` validates the scheme, type-checks and builds the static site.
- `npm run check` runs all of the above; run it at the end of every phase.
- `npm run docs:scheme` regenerates docs/SCHEME.md from the mapping file.

## Hard rules

1. `scheme/palaka-hk.json` is the single source of truth. The engine, the chart, the help page,
   docs/SCHEME.md and the mapping tests are all driven by it. Never hard-code a key or a letter elsewhere.
2. The engine (`src/engine`) is pure TypeScript: no DOM, no imports from `src/editor`, `src/chart`,
   `src/app` or `src/help`. ESLint enforces this. It exports `toTelugu(roman)` and `toRoman(telugu)`.
3. Tokenise by longest match. Consonant + vowel gives the vowel sign; consonant + consonant gives a
   conjunct through the virama; a consonant followed by anything else gets a visible virama. `_` splits
   keys and outputs nothing (it does not end the syllable: `l_R` is లృ). `^` outputs ZWNJ. `__` closes
   the syllable. Text inside backticks passes through unchanged.
4. `toTelugu(toRoman(t))` equals `t` for all NFC text. The property tests prove it; never weaken them.
5. No dictionary, no prediction, no phonetic guessing, no network calls. The app is static, works
   offline and stores everything in the browser.
6. Unmapped characters pass through unchanged and raise a status-bar warning; nothing is silently dropped.
7. The editor field disables autocapitalize, autocorrect and spellcheck, and leaves IME composition alone.

## Maintenance rules

- The mapping file carries a version number. A key, once published, never changes meaning; new
  letters only take unused keys. `x` is only ever the last character of a key.
- `validateScheme` (run by the build and the tests) fails on key collisions, a letter with two
  canonical keys, a group missing from the chart, or any entry that breaks the round trip.
- Adding a letter is one line in the mapping, one line in `tests/golden/words.tsv`, and one line in the
  code point table in `tests/engine/mapping.test.ts`. Nothing else should need editing.
- `tests/golden/words.tsv` has been reviewed by a native reader. Do not change an existing line to
  make a test pass; fix the engine, or ask.
- Write the tests for a phase before its code. Work through the phases in docs/PLAN.md section 8 in
  order and stop for review at the end of each one.
- Keep docs/SCHEME.md (generated) and CHANGELOG.md current.
- If the plan is unclear or two rules conflict, ask instead of guessing.
