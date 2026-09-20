import { history } from '@codemirror/commands';
import {
  Annotation,
  EditorSelection,
  Facet,
  Prec,
  StateEffect,
  StateField,
  Transaction,
  type Extension,
} from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import type { ConvertOptions } from '../engine';
import { backspace, typeChar, type Composition } from './composer';

export type InputMode = 'telugu' | 'english';

/** The live syllable and where its rendered text starts in the document. */
export interface LiveSyllable extends Composition {
  from: number;
}

/** Conversion settings (Telugu digits …); reconfigure through a compartment. */
export const convertOptions = Facet.define<ConvertOptions, ConvertOptions>({
  combine: (values) => values[0] ?? {},
});

export const setMode = StateEffect.define<InputMode>();
const setLive = StateEffect.define<LiveSyllable | null>();
const setUnmapped = StateEffect.define<string[]>();

/** Marks our own edits so that the undo history groups them by syllable, not by time. */
const syllableEdit = Annotation.define<'start' | 'continue'>();

export const modeField = StateField.define<InputMode>({
  create: () => 'telugu',
  update(mode, tr) {
    for (const effect of tr.effects) if (effect.is(setMode)) return effect.value;
    return mode;
  },
});

/**
 * The syllable in progress. Any edit or selection change that is not our own
 * (cursor move, click, paste, undo, Enter, mode switch) ends it.
 */
export const liveField = StateField.define<LiveSyllable | null>({
  create: () => null,
  update(live, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setLive)) return effect.value;
      if (effect.is(setMode)) return null;
    }
    return tr.docChanged || tr.selection ? null : live;
  },
});

export const setCapsLock = StateEffect.define<boolean>();

export const capsLockField = StateField.define<boolean>({
  create: () => false,
  update(on, tr) {
    for (const effect of tr.effects) if (effect.is(setCapsLock)) return effect.value;
    return on;
  },
});

/** The scheme is case-sensitive, so a stuck Caps Lock silently changes every letter: watch it. */
function watchCapsLock(event: KeyboardEvent | MouseEvent, view: EditorView): boolean {
  const on = event.getModifierState('CapsLock');
  if (on !== view.state.field(capsLockField)) view.dispatch({ effects: setCapsLock.of(on) });
  return false;
}

/** Unmapped letters of the latest keystroke; cleared by the next edit. */
export const unmappedField = StateField.define<string[]>({
  create: () => [],
  update(unmapped, tr) {
    for (const effect of tr.effects) if (effect.is(setUnmapped)) return effect.value;
    return tr.docChanged ? [] : unmapped;
  },
});

/** The live syllable, provided the cursor still sits right after its rendered text. */
function liveAtCursor(view: EditorView): LiveSyllable | null {
  const live = view.state.field(liveField);
  const { main } = view.state.selection;
  if (!live || !main.empty) return null;
  const end = live.from + live.rendered.length;
  if (main.head !== end || view.state.sliceDoc(live.from, end) !== live.rendered) return null;
  return live;
}

const TELUGU_ONLY = /^[\u0C00-\u0C7F\u200C\u200D]*$/;

/**
 * The live syllable, if this keystroke belongs to it. A live pollu joins the letter after it into
 * one conjunct, and the browser then reports the keystroke at the far side of that cluster; the
 * cursor in the editor state is what counts.
 */
function continuesLive(view: EditorView, from: number, to: number): LiveSyllable | null {
  const live = liveAtCursor(view);
  if (!live || from !== to) return null;
  const end = live.from + live.rendered.length;
  return from >= end && TELUGU_ONLY.test(view.state.sliceDoc(end, from)) ? live : null;
}

const PRINTABLE_ASCII = /^[\x20-\x7E]+$/;

function handleInput(view: EditorView, from: number, to: number, text: string): boolean {
  if (view.state.field(modeField) !== 'telugu') return false;
  // Another input method (IME, a system Telugu keyboard) is at work: leave it alone.
  if (view.composing || view.compositionStarted || !PRINTABLE_ASCII.test(text)) return false;

  const options = view.state.facet(convertOptions);
  const before = continuesLive(view, from, to);
  const continues = before !== null;
  const start = before ? before.from : from;
  if (before) to = before.from + before.rendered.length;

  let composition: Composition | null = before;
  let committed = '';
  let cut = false;
  const unmapped: string[] = [];
  for (const char of text) {
    const step = typeChar(composition, char, options);
    if (step.committed && step.composition) cut = true;
    committed += step.committed;
    composition = step.composition;
    unmapped.push(...step.unmapped);
  }

  const insert = committed + (composition?.rendered ?? '');
  const live = composition ? { ...composition, from: start + committed.length } : null;
  const touchesSyllable = continues || live !== null;
  view.dispatch({
    changes: { from: start, to, insert },
    selection: EditorSelection.cursor(start + insert.length),
    effects: [setLive.of(live), setUnmapped.of(unmapped)],
    annotations: touchesSyllable ? syllableEdit.of(continues && !cut ? 'continue' : 'start') : undefined,
    userEvent: 'input.type',
    scrollIntoView: true,
  });
  return true;
}

function handleBackspace(view: EditorView): boolean {
  const live = liveAtCursor(view);
  if (live) {
    const next = backspace(live, view.state.facet(convertOptions));
    const insert = next?.rendered ?? '';
    view.dispatch({
      changes: { from: live.from, to: live.from + live.rendered.length, insert },
      selection: EditorSelection.cursor(live.from + insert.length),
      effects: setLive.of(next ? { ...next, from: live.from } : null),
      annotations: syllableEdit.of('continue'),
      userEvent: 'delete.backward',
      scrollIntoView: true,
    });
    return true;
  }

  // One code point, not one cluster: a vowel sign can go without taking its consonant.
  const { main } = view.state.selection;
  if (!main.empty || main.head === 0) return false;
  const lineStart = view.state.doc.lineAt(main.head).from;
  const tail = view.state.sliceDoc(Math.max(lineStart, main.head - 2), main.head);
  const size = tail.length === 2 && tail.codePointAt(0)! > 0xffff ? 2 : 1;
  view.dispatch({
    changes: { from: main.head - size, to: main.head },
    userEvent: 'delete.backward',
    scrollIntoView: true,
  });
  return true;
}

export function toggleMode(view: EditorView): boolean {
  const next: InputMode = view.state.field(modeField) === 'telugu' ? 'english' : 'telugu';
  view.dispatch({ effects: setMode.of(next) });
  return true;
}

const TIME_GROUP_MS = 500;

/** Undo history in which one live syllable is one undo step. */
function syllableHistory(): Extension {
  let previousTime = 0;
  return history({
    // The time limit is applied below, and only to edits that are not ours.
    newGroupDelay: Number.MAX_SAFE_INTEGER,
    joinToEvent(tr, isAdjacent) {
      const time = tr.annotation(Transaction.time) ?? 0;
      const recent = time - previousTime < TIME_GROUP_MS;
      previousTime = time;
      const kind = tr.annotation(syllableEdit);
      return kind ? kind === 'continue' : isAdjacent && recent;
    },
  });
}

/** Key binding of the Telugu/English switch; kept apart so that it can be reconfigured. */
export function modeShortcut(key: string): Extension {
  return Prec.high(keymap.of([{ key, run: toggleMode, preventDefault: true }]));
}

export function liveTyping(): Extension {
  return [
    modeField,
    liveField,
    unmappedField,
    capsLockField,
    EditorView.domEventHandlers({ keydown: watchCapsLock, keyup: watchCapsLock, mousedown: watchCapsLock }),
    syllableHistory(),
    EditorView.inputHandler.of(handleInput),
    Prec.high(keymap.of([{ key: 'Backspace', run: handleBackspace }])),
  ];
}
