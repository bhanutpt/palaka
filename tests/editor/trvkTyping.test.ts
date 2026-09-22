import { EditorState, type TransactionSpec } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { setMode } from '../../src/editor/liveTyping';
import {
  applyTrvkResult,
  backspaceInTrvk,
  correctedField,
  trvkField,
  trvkRequests,
  trvkState,
  typeInTrvk,
  type TrvkRequest,
} from '../../src/editor/trvkTyping';
import { TGT_CLOSE, TGT_OPEN } from '../../src/trvk/tokens';

/** An editor in TRVK mode with an empty document, and nothing else in it. */
function editor(doc = ''): EditorState {
  const state = EditorState.create({ doc, extensions: [trvkState()] });
  return state.update({ effects: setMode.of('trvk') }).state;
}

/** Applies what a keystroke asks for, as the view would. */
function apply(state: EditorState, spec: TransactionSpec | null): EditorState {
  return spec ? state.update(spec).state : state;
}

/** Types loose roman one character at a time. */
function type(state: EditorState, text: string): EditorState {
  for (const char of text) state = apply(state, typeInTrvk(state, char));
  return state;
}

const ring = (state: EditorState) => state.field(trvkField);
const raws = (state: EditorState) => ring(state).words.map((word) => word.raw);

describe('typing loose roman in TRVK mode', () => {
  it('renders the word through the rule table as it is typed', () => {
    const state = type(editor(), 'nenu');
    // n-e-n-u through the table is plain `nenu`, which the engine writes as నెను.
    expect(state.doc.toString()).toBe('నెను');
    expect(raws(state)).toEqual(['nenu']);
    expect(state.selection.main.head).toBe(4);
  });

  it('rewrites the whole word on every keystroke, never appending to it', () => {
    const state = type(editor(), 'sham');
    // `sh` became S and the final m an anusvara: appending letter by letter could not do this.
    expect(ring(state).words[0].hk).toBe('SaM');
    expect(state.doc.toString()).toBe('షం');
  });

  it('keeps the words apart and remembers each one as it was typed', () => {
    const state = type(editor(), 'nenu eeroju');
    expect(raws(state)).toEqual(['nenu', 'eeroju']);
    // The rule table turns `ee` into I: the vowel is already right, the rest is not yet.
    expect(state.doc.toString()).toBe('నెను ఈరొజు');
  });

  it('starts a fresh line with no context from the line before', () => {
    const state = type(editor(), 'nenu\nintiki');
    expect(raws(state)).toEqual(['intiki']);
  });

  it('leaves everything alone when the mode is not TRVK', () => {
    const plain = EditorState.create({ extensions: [trvkState()] });
    expect(typeInTrvk(plain, 'n')).toBeNull();
  });

  it('forgets the words when the mode is switched away', () => {
    const state = type(editor(), 'nenu');
    const after = state.update({ effects: setMode.of('telugu') }).state;
    expect(raws(after)).toEqual([]);
  });

  it('keeps only the last few words, so the ring cannot grow with the document', () => {
    const state = type(editor(), 'a b c d e f g h i j k');
    expect(ring(state).words.length).toBeLessThanOrEqual(8);
    expect(raws(state).at(-1)).toBe('k');
  });
});

describe('backspace in TRVK mode', () => {
  it('takes one loose roman letter off and re-renders the word', () => {
    let state = type(editor(), 'sham');
    state = apply(state, backspaceInTrvk(state));
    expect(ring(state).words[0].raw).toBe('sha');
    expect(state.doc.toString()).toBe('ష');
  });

  it('removes the word altogether when its last letter goes', () => {
    let state = type(editor(), 'nenu a');
    for (let i = 0; i < 1; i++) state = apply(state, backspaceInTrvk(state));
    expect(raws(state)).toEqual(['nenu']);
    expect(state.doc.toString()).toBe('నెను ');
  });

  it('reopens the word before it when the space goes, so typing carries on', () => {
    let state = type(editor(), 'nenu ');
    state = apply(state, backspaceInTrvk(state));
    expect(state.doc.toString()).toBe('నెను');
    state = type(state, 'u');
    expect(raws(state)).toEqual(['nenuu']);
  });

  it('leaves a word another edit has locked to the ordinary backspace', () => {
    let state = type(editor(), 'nenu');
    state = state.update({ changes: { from: 4, insert: 'x' } }).state;
    expect(backspaceInTrvk(state)).toBeNull();
  });
});

describe('what the model is asked for', () => {
  const requests = (state: EditorState, options = {}) => trvkRequests(ring(state), options);

  it('asks for the word being typed, with the words before it and no right context', () => {
    const state = type(editor(), 'nenu eeroju inti');
    const live = requests(state).filter((request) => request.pass === 'live');
    expect(live).toHaveLength(1);
    expect(live[0].text).toBe(`nenu eeroju ${TGT_OPEN}inti${TGT_CLOSE}`);
  });

  it('asks again for a word once its successor exists, this time with right context', () => {
    const state = type(editor(), 'nenu eeroju');
    const final = requests(state).filter((request) => request.pass === 'final');
    expect(final).toHaveLength(1);
    expect(final[0].index).toBe(0);
    expect(final[0].text).toBe(`${TGT_OPEN}nenu${TGT_CLOSE} eeroju`);
  });

  it('asks nothing while nothing has been typed', () => {
    expect(requests(editor())).toEqual([]);
  });

  it('does not ask twice for the same spelling of the same word', () => {
    const state = type(editor(), 'nenu');
    const first = requests(state);
    expect(first).toHaveLength(1);
    const answered = apply(state, applyTrvkResult(state, first[0], 'nEnu'));
    expect(requests(answered)).toEqual([]);
  });

  it('leaves the second pass out when re-correction is switched off', () => {
    const state = type(editor(), 'nenu eeroju');
    expect(requests(state, { recorrect: false }).every((request) => request.pass === 'live')).toBe(true);
  });

  it('narrows the context to the number of words asked for', () => {
    const state = type(editor(), 'a b c d e');
    const live = requests(state, { context: 1 }).find((request) => request.pass === 'live')!;
    expect(live.text).toBe(`d ${TGT_OPEN}e${TGT_CLOSE}`);
  });
});

describe('a correction coming back from the model', () => {
  const answer = (state: EditorState, hk: string, pick: (request: TrvkRequest) => boolean = () => true) => {
    const request = trvkRequests(ring(state), {}).find(pick)!;
    return apply(state, applyTrvkResult(state, request, hk));
  };

  it('replaces the word in the document and keeps the cursor where it was', () => {
    const typed = type(editor(), 'nenu');
    const state = answer(typed, 'nEnu');
    expect(state.doc.toString()).toBe('నేను');
    expect(state.selection.main.head).toBe(4);
  });

  it('moves the cursor with the word when the correction is longer', () => {
    const typed = type(editor(), 'vellanu');
    const state = answer(typed, 'vELLanu');
    expect(state.doc.toString()).toBe('వేళ్ళను');
    expect(state.selection.main.head).toBe(state.doc.length);
  });

  it('corrects an earlier word without disturbing the one being typed', () => {
    const typed = type(editor(), 'nenu eeroju');
    const state = answer(typed, 'nEnu', (request) => request.pass === 'final');
    expect(state.doc.toString()).toBe('నేను ఈరొజు');
    // The second word moved with the first and is still the one being typed.
    expect(ring(state).words[1].from).toBe(5);
    expect(ring(state).words[1].raw).toBe('eeroju');
  });

  it('locks a word after its pass with right context, and asks no more', () => {
    const typed = type(editor(), 'nenu eeroju');
    const state = answer(typed, 'nEnu', (request) => request.pass === 'final');
    expect(ring(state).words[0].locked).toBe(true);
    expect(trvkRequests(ring(state), {}).some((request) => request.index === 0)).toBe(false);
  });

  it('underlines a word it changed after the writer had moved on', () => {
    const typed = type(editor(), 'nenu eeroju');
    const state = answer(typed, 'nEnu', (request) => request.pass === 'final');
    expect(state.field(correctedField).size).toBe(1);
  });

  it('underlines nothing while the word is still being typed', () => {
    const typed = type(editor(), 'nenu');
    const state = answer(typed, 'nEnu');
    expect(state.field(correctedField).size).toBe(0);
  });

  it('is dropped when the word changed while the request was in flight', () => {
    const typed = type(editor(), 'nen');
    const request = trvkRequests(ring(typed), {})[0];
    const later = type(typed, 'u');
    expect(applyTrvkResult(later, request, 'nen')).toBeNull();
    expect(later.doc.toString()).toBe('నెను');
  });

  it('is dropped when the model answers for a word that is no longer there', () => {
    const typed = type(editor(), 'nenu');
    const request = trvkRequests(ring(typed), {})[0];
    const cleared = typed.update({ effects: setMode.of('telugu') }).state;
    expect(applyTrvkResult(cleared, request, 'nEnu')).toBeNull();
  });

  it('writes nothing when the model agrees with what is on screen', () => {
    const typed = type(editor(), 'nenu');
    const request = trvkRequests(ring(typed), {})[0];
    const spec = applyTrvkResult(typed, request, 'nenu')!;
    expect(spec.changes).toBeUndefined();
    expect(apply(typed, spec).doc.toString()).toBe('నెను');
  });

  it('never puts Telugu of its own into the document: the engine writes it', () => {
    const typed = type(editor(), 'krishna');
    const state = answer(typed, 'kRSNa');
    expect(state.doc.toString()).toBe('కృష్ణ');
  });
});

describe('an edit made by any other means', () => {
  it('locks the word it touches, so the model never overwrites it', () => {
    let state = type(editor(), 'nenu eeroju');
    state = state.update({ changes: { from: 1, to: 2, insert: 'ా' } }).state;
    expect(ring(state).words[0].locked).toBe(true);
    expect(trvkRequests(ring(state), {}).some((request) => request.index === 0)).toBe(false);
  });

  it('moves the words that follow it, so the ring still points at the right text', () => {
    let state = type(editor(), 'nenu eeroju');
    state = state.update({ changes: { from: 0, insert: 'కా' } }).state;
    expect(ring(state).words[1].from).toBe(7);
  });
});
