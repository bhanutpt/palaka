import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Annotation, EditorState, Transaction, type Text } from '@codemirror/state';
import { EditorView, drawSelection, keymap, type ViewUpdate } from '@codemirror/view';
import { convert, toRoman, type ConvertOptions } from '../engine';

/**
 * The split view: a second editor that shows the roman source of the same text. Both panes are
 * editable and stay in step.
 *
 * Conversion never crosses a line break in either direction, so the two documents always have the
 * same lines, and an edit is carried over by converting just the lines it touched. The roman pane
 * keeps what the writer typed there, even if it is not the canonical spelling; it is rewritten
 * canonically when the Telugu side of that line changes, or when the pane loses the focus.
 */

/** Marks the transactions that carry an edit from one pane to the other, so that they are not echoed back. */
const mirrored = Annotation.define<boolean>();

export interface RomanPane {
  view: EditorView;
  /** Rewrites the whole roman text from the Telugu text. */
  refresh(): void;
  setActive(active: boolean): void;
  /** Give this to the main editor as its update callback. */
  teluguChanged(update: ViewUpdate): void;
}

type ConvertLine = (line: string) => string;

function lines(doc: Text, from: number, to: number, convertLine: ConvertLine): string {
  const out: string[] = [];
  for (let n = from; n <= to; n++) out.push(convertLine(doc.line(n).text));
  return out.join('\n');
}

/** Carries the lines touched by `update` over to `target`, converted. */
function mirror(update: ViewUpdate, target: EditorView, convertLine: ConvertLine): void {
  const before = update.startState.doc;
  const after = update.state.doc;
  if (target.state.doc.lines !== before.lines) {
    replaceAll(target, lines(after, 1, after.lines, convertLine));
    return;
  }

  let fromA = Infinity;
  let toA = -1;
  let fromB = Infinity;
  let toB = -1;
  update.changes.iterChangedRanges((a0, a1, b0, b1) => {
    fromA = Math.min(fromA, a0);
    toA = Math.max(toA, a1);
    fromB = Math.min(fromB, b0);
    toB = Math.max(toB, b1);
  });
  if (toA < 0) return;

  const firstLine = before.lineAt(fromA).number;
  const lastLineBefore = before.lineAt(toA).number;
  const lastLineAfter = after.lineAt(toB).number;
  target.dispatch({
    changes: {
      from: target.state.doc.line(firstLine).from,
      to: target.state.doc.line(lastLineBefore).to,
      insert: lines(after, firstLine, lastLineAfter, convertLine),
    },
    annotations: [mirrored.of(true), Transaction.addToHistory.of(false)],
  });
}

function replaceAll(target: EditorView, text: string): void {
  if (target.state.doc.toString() === text) return;
  target.dispatch({
    changes: { from: 0, to: target.state.doc.length, insert: text },
    annotations: [mirrored.of(true), Transaction.addToHistory.of(false)],
  });
}

const isMirrored = (update: ViewUpdate) => update.transactions.some((tr) => tr.annotation(mirrored));

export function createRomanPane(parent: HTMLElement, telugu: EditorView, getOptions: () => ConvertOptions): RomanPane {
  let active = false;
  const toRomanLine: ConvertLine = (line) => toRoman(line, getOptions());
  const toTeluguLine: ConvertLine = (line) => convert(line, getOptions()).text;

  const refresh = () => {
    if (!active) return;
    const doc = telugu.state.doc;
    replaceAll(view, lines(doc, 1, doc.lines, toRomanLine));
  };

  const view: EditorView = new EditorView({
    parent,
    state: EditorState.create({
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        drawSelection(),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
          'aria-label': 'Roman source (Palaka-HK)',
        }),
        EditorView.updateListener.of((update) => {
          if (active && update.docChanged && !isMirrored(update)) mirror(update, telugu, toTeluguLine);
        }),
        EditorView.domEventHandlers({
          blur: refresh,
        }),
      ],
    }),
  });

  return {
    view,
    refresh,
    setActive(next) {
      active = next;
      refresh();
    },
    teluguChanged(update) {
      if (active && update.docChanged && !isMirrored(update)) mirror(update, view, toRomanLine);
    },
  };
}
