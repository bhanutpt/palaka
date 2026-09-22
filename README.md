# పలక! (Palaka)

A writing slate for Telugu. You type roman letters in a fixed scheme, **Palaka-HK** (Harvard-Kyoto
with Telugu extensions), and get exact Telugu Unicode.

Telugu typing tools guess. Palaka does not. One key sequence always gives one output, and any Telugu
text converts back to exactly one roman spelling. There is no dictionary, no prediction and no
network: the app is a static page that works offline and keeps everything in your browser.

| Typed | Result |
| --- | --- |
| `palaka` | పలక |
| `telugu` | తెలుగు |
| `nEnu telugu rAstunnAnu` | నేను తెలుగు రాస్తున్నాను |
| `dEzaM` | దేశం |
| `kRSNa` | కృష్ణ |
| `jJAnaM` | జ్ఞానం |
| `gurraM` | గుర్రం |
| `ceTTu` | చెట్టు |
| `sAphT^vEr` | సాఫ్ట్‌వేర్ |

The scheme is case-sensitive: lower case is the short or plain sound, upper case the long, retroflex
or special one. `_` splits two keys that would otherwise merge, `^` keeps a pollu visible (ZWNJ), and
text between backticks stays as it is. The whole scheme, with every key and rule, is in
[docs/SCHEME.md](docs/SCHEME.md); the same page is built into the app under Help (F1).

## What it does

- **Live typing** in a CodeMirror editor: the syllable in progress is re-rendered on every key, and
  Backspace and undo work by roman key and by syllable.
- **Character chart** in the traditional varnamala order, generated from the mapping. Tiles insert on
  click and light up as their key is typed; every consonant opens its guninta. On a phone the chart
  is a drawer at the bottom of the screen and works as the keyboard.
- **Verification tools**: an editable roman pane that stays in step with the text, the roman
  spelling and code points of whatever is under the cursor, a text inspector for invisible
  characters, stray signs and look-alike letters, find and replace in Telugu or roman, and bulk
  conversion of roman text typed elsewhere.
- **Documents**: autosave to the browser with crash recovery, several documents, open and save
  UTF-8 `.txt`, copy all.
- **Comfort**: light and dark themes, bundled Noto Sans and Noto Serif Telugu, font size, Telugu
  digits, a choice of key for the Telugu/English switch.
- **TRVK mode** (off by default): type the loose roman you would use in a chat message and a small
  model on your device writes Palaka-HK for it, which the same engine turns into Telugu. See below.
- **Offline**: installable as an app; after the first visit it starts with no network at all.
- **Accessible**: everything works from the keyboard (F6 moves between the text and the chart, the
  arrow keys walk the toolbar, Escape goes back to the text), controls are labelled for screen
  readers, and both themes meet WCAG AA contrast.

## TRVK: loose roman, corrected as you type

**TRVK** (తెలుగు రోమన్ వ్యావహారిక క్రమం, "Telugu roman as it is used") is the spelling people actually
type. Palaka-HK asks you to know that `nEnu` has a long `E`; TRVK lets you type `nenu` and have the
app work it out:

| Typed loosely | On screen |
| --- | --- |
| `nenu eeroju intiki vellanu` | నేను ఈరోజు ఇంటికి వేళ్ళను |
| `manchi telugu pusthakam` | మంచి తెలుగు పుస్తకం |

Switch it on under *Settings → TRVK*; the typing switch then cycles Telugu → TRVK → English. A word
is corrected while you type it and once more when the next word appears, because the neighbours are
often what decide the spelling. A word you go back and edit yourself is never touched again.

What it is not: a system that is always right. It is wrong often enough on names, English words and
chat-style forms that the two modes belong together — **draft loosely in TRVK, then switch to
Palaka-HK and fix what is wrong, key by key**, with exactly the behaviour this app has always had.
Palaka-HK mode is unchanged: no dictionary, no prediction, no guessing.

How it works, and what it costs: a 1.9 MB character tagger (a small transformer, trained on Telugu
Wikipedia romanised by Palaka's own converter plus a noise model, and measured against Google's
Dakshina romanisations) runs in a Web Worker through ONNX Runtime Web. The model reads loose roman
and writes Palaka-HK — never Telugu, which only the engine writes. The first switch-on downloads
about 5 MB from this site, most of it the runtime; after that the mode works offline like the rest
of the app. Nothing is ever sent anywhere: there is no request to any other origin, and the
Playwright tests assert it. The model and how it was trained live in a separate repository, `trvk`.

## Use it

Open the site, type. Nothing is installed and nothing leaves your computer. To keep it as an app,
use your browser's *Install* command.

To run it yourself you need Node.js 22 or newer:

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`. It uses relative paths, so it can be served from
any folder of any static host, or opened through any local file server.

## Develop

| Command | What it does |
| --- | --- |
| `npm test` | unit tests: engine, composer, chart, documents, settings, help, contrast |
| `npm run test:e2e` | builds, then runs the Playwright tests in a real browser |
| `npm run lint`, `npm run typecheck` | ESLint and TypeScript |
| `npm run build` | validates the scheme, type-checks and builds |
| `npm run check` | all of the above; run it before every commit |
| `npm run docs:scheme` | regenerates docs/SCHEME.md from the mapping |

`scheme/palaka-hk.json` is the single source of truth: the engine, the chart, the help page,
docs/SCHEME.md and the mapping tests are all driven by it. Adding a letter is one line in the
mapping, one line in `tests/golden/words.tsv` and one line in the code point table of
`tests/engine/mapping.test.ts`. A key, once published, never changes its meaning.

The rules every change has to keep are in [CLAUDE.md](CLAUDE.md). How the parts fit together is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), the original plan in [docs/PLAN.md](docs/PLAN.md), and
the history in [CHANGELOG.md](CHANGELOG.md).

## Deploy

The repository deploys itself to GitHub Pages: every push to `main` runs the full check and then
publishes `dist/` (see `.github/workflows/deploy.yml`). The one-time set-up is, in the repository's
settings, **Pages → Source → GitHub Actions**. Any other static host works the same way: build,
then upload `dist/`.

## Quality checklist

Checked by the test suite on every push:

- every golden word pair, in both directions, and `toTelugu(toRoman(t)) = t` for random NFC text;
- the mapping has no key collisions and every key appears exactly once in the chart;
- real keystrokes in a real browser: typing, backspace, cursor moves, paste, undo, mode switch;
- no WCAG 2.1 A or AA violations (axe) in either theme, on a desktop and on a phone-sized screen;
- the colour contrast of both palettes;
- a 100,000-character document still types within one frame per key, with every tool switched on;
- the app loads with the network switched off, and makes no request to any other site.

Checked by hand before a release: current Chrome, Firefox, Edge and Safari, and one Android phone.

## Licence

MIT, see [LICENSE](LICENSE).
