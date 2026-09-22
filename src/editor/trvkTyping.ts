/**
 * TRVK mode in the editor: the writer types loose roman, the rule table renders the word at
 * once so the screen never lags, and the model's answer replaces it a moment later.
 *
 * The document only ever holds engine output. The model writes Palaka-HK; `convert` turns it
 * into Telugu exactly as it does for a key typed by hand. The loose roman lives in the word
 * ring, in editor state, and never in the document.
 *
 * The decisions are pure functions over `EditorState` so that they can be tested without a
 * browser; the extension at the bottom is only the wiring — the input handler, the debounce
 * and the model call.
 */

import {
  EditorSelection,
  Prec,
  StateEffect,
  StateField,
  type EditorState,
  type Extension,
  type TransactionSpec,
} from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { convert, type ConvertOptions } from '../engine';
import { naive } from '../trvk/naive';
import {
  correct,
  currentIndex,
  emptyRing,
  pendingFinal,
  rawWords,
  setCurrent,
  startWord,
  touch,
  trim,
  wordEnd,
  type Pass,
  type Ring,
} from '../trvk/ring';
import { cutWindow } from '../trvk/windowing';
import { convertOptions, modeField, setMode, syllableEdit } from './liveTyping';

/** Words kept in the ring: three of context on each side, the current one, and room to spare. */
const MAX_WORDS = 8;
const PRINTABLE_ASCII = /^[\x20-\x7E]$/;
const DEBOUNCE_MS = 40;

/** Marks a transaction as TRVK mode's own, so that the ring is carried rather than locked. */
const setRing = StateEffect.define<Ring>();

const render = (hk: string, options: ConvertOptions): string => convert(hk, options).text;

/**
 * The recent words and where their Telugu sits. Our own transactions carry the new ring;
 * anything else that changes the document moves the words and locks the ones it touched.
 */
export const trvkField = StateField.define<Ring>({
  create: emptyRing,
  update(ring, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setRing)) return effect.value;
      if (effect.is(setMode)) return emptyRing();
    }
    if (!tr.docChanged || ring.words.length === 0) return ring;

    let locked = ring;
    tr.changes.iterChangedRanges((fromA, toA) => {
      locked = touch(locked, fromA, toA);
    });
    return { words: locked.words.map((word) => ({ ...word, from: tr.changes.mapPos(word.from, 1) })), stamp: ring.stamp };
  },
});

/** The field and the mode it depends on; enough to work with TRVK state in a test. */
export const trvkState = (): Extension => [modeField, trvkField];

/** The word being typed, when the cursor still sits right after its rendered Telugu. */
function continuing(state: EditorState, ring: Ring, cursor: number): boolean {
  const word = ring.words[currentIndex(ring)];
  if (!word || word.locked) return false;
  const end = wordEnd(word);
  return end === cursor && state.sliceDoc(word.from, end) === word.rendered;
}

/** One typed character in TRVK mode. Null when this keystroke is not ours to handle. */
export function typeInTrvk(state: EditorState, char: string): TransactionSpec | null {
  if (state.field(modeField, false) !== 'trvk') return null;
  const { main } = state.selection;
  if (!main.empty) return null;
  if (char !== '\n' && !PRINTABLE_ASCII.test(char)) return null;

  const ring = state.field(trvkField);
  const cursor = main.head;
  const common = { userEvent: 'input.type', scrollIntoView: true } as const;

  // A line break ends the ring: a window never reaches across lines.
  if (char === '\n') {
    return {
      ...common,
      changes: { from: cursor, insert: '\n' },
      selection: EditorSelection.cursor(cursor + 1),
      effects: [setRing.of(emptyRing())],
      annotations: [syllableEdit.of('start')],
    };
  }

  // A space stands as it is typed; the next letter starts a new word.
  if (/\s/.test(char)) {
    return {
      ...common,
      changes: { from: cursor, insert: char },
      selection: EditorSelection.cursor(cursor + 1),
      effects: [setRing.of(ring)],
      annotations: [syllableEdit.of('start')],
    };
  }

  const continues = continuing(state, ring, cursor);
  const word = ring.words[currentIndex(ring)];
  // A cursor that has moved back into older text: those words are no longer ours to extend.
  const base = continues ? ring : word && cursor < wordEnd(word) ? emptyRing() : ring;

  const raw = (continues ? word.raw : '') + char;
  const hk = naive(raw);
  const rendered = render(hk, state.facet(convertOptions));
  const from = continues ? word.from : cursor;
  const to = continues ? wordEnd(word) : cursor;
  const next = setCurrent(continues ? base : trim(startWord(base, from), MAX_WORDS), raw, hk, rendered);

  return {
    ...common,
    changes: { from, to, insert: rendered },
    selection: EditorSelection.cursor(from + rendered.length),
    effects: [setRing.of(next)],
    annotations: [syllableEdit.of(continues ? 'continue' : 'start')],
  };
}

/** Backspace in TRVK mode: one loose roman letter off the word being typed. */
export function backspaceInTrvk(state: EditorState): TransactionSpec | null {
  if (state.field(modeField, false) !== 'trvk') return null;
  const { main } = state.selection;
  if (!main.empty) return null;

  const ring = state.field(trvkField);
  const cursor = main.head;
  const common = { userEvent: 'delete.backward', scrollIntoView: true } as const;

  if (!continuing(state, ring, cursor)) {
    // At a word boundary: the space goes and the word before it is open again, so the writer
    // can carry on typing into it rather than starting a new one.
    const previous = ring.words[currentIndex(ring)];
    const reopens =
      previous &&
      !previous.locked &&
      cursor === wordEnd(previous) + 1 &&
      /^[ \t]$/.test(state.sliceDoc(cursor - 1, cursor)) &&
      state.sliceDoc(previous.from, wordEnd(previous)) === previous.rendered;
    if (!reopens) return null;
    return {
      ...common,
      changes: { from: cursor - 1, to: cursor },
      selection: EditorSelection.cursor(cursor - 1),
      effects: [setRing.of(ring)],
      annotations: [syllableEdit.of('continue')],
    };
  }

  const index = currentIndex(ring);
  const word = ring.words[index];
  if (word.raw.length === 0) return null;

  const raw = word.raw.slice(0, -1);

  // The last letter of the word: the word goes with it.
  if (raw === '') {
    return {
      ...common,
      changes: { from: word.from, to: wordEnd(word), insert: '' },
      selection: EditorSelection.cursor(word.from),
      effects: [setRing.of({ words: ring.words.slice(0, index), stamp: ring.stamp })],
      annotations: [syllableEdit.of('continue')],
    };
  }

  const hk = naive(raw);
  const rendered = render(hk, state.facet(convertOptions));
  return {
    ...common,
    changes: { from: word.from, to: wordEnd(word), insert: rendered },
    selection: EditorSelection.cursor(word.from + rendered.length),
    effects: [setRing.of(setCurrent(ring, raw, hk, rendered))],
    annotations: [syllableEdit.of('continue')],
  };
}

/** One thing to ask the model: a window, and the word in the ring it belongs to. */
export interface TrvkRequest {
  index: number;
  stamp: number;
  /** The window text, the word to correct between the markers. */
  text: string;
  pass: Pass;
}

export interface RequestOptions {
  /** Words of context on each side, 1 to 3. */
  context?: number;
  /** Whether a word is corrected once more when its successor appears. Default true. */
  recorrect?: boolean;
}

/**
 * What the model should be asked for, given what has been typed: the word in progress with no
 * right context (live typing has no future), and every earlier word that now has a successor
 * and has not had its one pass with right context yet.
 */
export function trvkRequests(ring: Ring, options: RequestOptions = {}): TrvkRequest[] {
  const { context = 3, recorrect = true } = options;
  const words = rawWords(ring);
  const cut = { maxLeft: context, maxRight: context };
  const requests: TrvkRequest[] = [];

  const current = currentIndex(ring);
  const word = ring.words[current];
  if (word && word.raw !== '' && !word.locked && word.pass === 'naive') {
    requests.push({ index: current, stamp: word.stamp, text: cutWindow(words, current, cut).text, pass: 'live' });
  }
  if (recorrect) {
    for (const index of pendingFinal(ring)) {
      requests.push({ index, stamp: ring.words[index].stamp, text: cutWindow(words, index, cut).text, pass: 'final' });
    }
  }
  return requests;
}

/**
 * The model's answer for one request. Null when it is stale — the word was edited, locked or
 * forgotten while the request was in flight — which is what keeps a fast typist from seeing
 * an old correction land on a new word.
 */
export function applyTrvkResult(state: EditorState, request: TrvkRequest, hk: string): TransactionSpec | null {
  if (state.field(modeField, false) !== 'trvk') return null;
  const ring = state.field(trvkField);
  const rendered = render(hk, state.facet(convertOptions));
  const step = correct(ring, request.index, request.stamp, hk, rendered, request.pass);
  if (!step) return null;
  if (!step.change) return { effects: [setRing.of(step.ring)] };

  const { from, to, insert } = step.change;
  const head = state.selection.main.head;
  const delta = insert.length - (to - from);
  return {
    changes: step.change,
    // The word being typed sits after the one corrected: the cursor moves with it.
    selection: state.selection.main.empty && head >= to ? EditorSelection.cursor(head + delta) : undefined,
    effects: [setRing.of(step.ring)],
    // Its own undo step, so one undo puts back what the writer had before the correction.
    annotations: [syllableEdit.of('start')],
    userEvent: 'input',
  };
}

export interface TrvkTypingConfig {
  /** Palaka-HK for the marked word of a window. Rejects when the model fails. */
  correct(text: string): Promise<string>;
  /** False while the model is not ready: the rule table renders and nothing is asked. */
  ready(): boolean;
  recorrect?(): boolean;
  context?(): number;
  debounce?: number;
  onError?(message: string): void;
}

/** TRVK mode: the input handler, the debounce and the model call. */
export function trvkTyping(config: TrvkTypingConfig): Extension {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const ask = async (view: EditorView) => {
    if (!config.ready() || view.state.field(modeField) !== 'trvk') return;
    const requests = trvkRequests(view.state.field(trvkField), {
      context: config.context?.(),
      recorrect: config.recorrect?.(),
    });
    for (const request of requests) {
      try {
        const hk = await config.correct(request.text);
        const spec = applyTrvkResult(view.state, request, hk);
        if (spec) view.dispatch(spec);
      } catch (error) {
        config.onError?.(error instanceof Error ? error.message : String(error));
        return;
      }
    }
  };

  /** One inference per burst of keystrokes, not one per key. */
  const schedule = (view: EditorView) => {
    clearTimeout(timer);
    timer = setTimeout(() => void ask(view), config.debounce ?? DEBOUNCE_MS);
  };

  const run = (view: EditorView, spec: TransactionSpec | null): boolean => {
    if (!spec) return false;
    view.dispatch(spec);
    schedule(view);
    return true;
  };

  /** Text arriving in one piece — dictation, an autocorrecting keyboard — is typed out
   *  character by character, so that it goes through the ring like anything else rather than
   *  landing in the document as raw roman. */
  const runAll = (view: EditorView, text: string): boolean => {
    const specs: TransactionSpec[] = [];
    let state = view.state;
    for (const char of text) {
      const spec = typeInTrvk(state, char);
      if (!spec) return false;
      specs.push(spec);
      state = state.update(spec).state;
    }
    for (const spec of specs) view.dispatch(spec);
    schedule(view);
    return true;
  };

  return [
    trvkField,
    EditorView.inputHandler.of((view, _from, _to, text) => {
      if (view.state.field(modeField) !== 'trvk') return false;
      // Another input method (IME, a system keyboard) is at work: leave it alone.
      if (view.composing || view.compositionStarted) return false;
      return text.length === 1 ? run(view, typeInTrvk(view.state, text)) : runAll(view, text);
    }),
    Prec.highest(
      keymap.of([
        { key: 'Backspace', run: (view) => run(view, backspaceInTrvk(view.state)) },
        { key: 'Enter', run: (view) => run(view, typeInTrvk(view.state, '\n')) },
      ]),
    ),
  ];
}
