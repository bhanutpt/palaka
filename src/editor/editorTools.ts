import { EditorSelection, StateEffect, StateField, type Extension } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { findAll, type Query } from './findModel';
import { inspectLine } from './inspector';

/** CodeMirror side of the verification tools: the text inspector and the find highlights. */

// Text inspector

class HiddenCharWidget extends WidgetType {
  private readonly label: string;
  private readonly message: string;

  constructor(label: string, message: string) {
    super();
    this.label = label;
    this.message = message;
  }

  override eq(other: HiddenCharWidget): boolean {
    return other.label === this.label;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'insp-char';
    span.textContent = this.label;
    span.title = this.message;
    return span;
  }
}

function inspectVisible(view: EditorView): DecorationSet {
  const ranges = [];
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = view.state.doc.lineAt(pos);
      for (const finding of inspectLine(line.text)) {
        const decoration =
          finding.kind === 'invisible'
            ? Decoration.replace({ widget: new HiddenCharWidget(finding.label, finding.message) })
            : Decoration.mark({ class: `insp-${finding.kind}`, attributes: { title: finding.message } });
        ranges.push(decoration.range(line.from + finding.from, line.from + finding.to));
      }
      pos = line.to + 1;
    }
  }
  return Decoration.set(ranges, true);
}

/** Shows invisible characters as labels and marks stray signs and look-alike letters. */
export const inspector: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = inspectVisible(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = inspectVisible(update.view);
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

// Find

export const setFindQuery = StateEffect.define<Query | null>();

export interface FindState {
  query: Query | null;
  /** Start offsets of all matches in the document. */
  matches: number[];
  marks: DecorationSet;
}

const matchMark = Decoration.mark({ class: 'find-match' });

function search(query: Query | null, text: () => string): FindState {
  const matches = query ? findAll(text(), query) : [];
  const length = query?.needle.length ?? 0;
  return { query, matches, marks: Decoration.set(matches.map((from) => matchMark.range(from, from + length))) };
}

export const findField = StateField.define<FindState>({
  create: () => search(null, () => ''),
  update(value, tr) {
    let query = value.query;
    let changed = false;
    for (const effect of tr.effects) {
      if (effect.is(setFindQuery)) {
        query = effect.value;
        changed = true;
      }
    }
    if (!changed && !(tr.docChanged && query)) return value;
    return search(query, () => tr.newDoc.toString());
  },
  provide: (field) => EditorView.decorations.from(field, (state) => state.marks),
});

/** Selects the next (or previous) match after the selection, wrapping around. Returns its index, or -1. */
export function selectMatch(view: EditorView, direction: 1 | -1): number {
  const { matches, query } = view.state.field(findField);
  if (!query || matches.length === 0) return -1;
  const { main } = view.state.selection;
  let index: number;
  if (direction === 1) {
    index = matches.findIndex((from) => from >= main.to || (main.empty && from >= main.from));
    if (index < 0) index = 0;
  } else {
    index = matches.findLastIndex((from) => from + query.needle.length <= main.from);
    if (index < 0) index = matches.length - 1;
  }
  const from = matches[index];
  view.dispatch({
    selection: EditorSelection.range(from, from + query.needle.length),
    effects: EditorView.scrollIntoView(from, { y: 'center' }),
    userEvent: 'select.search',
  });
  return index;
}

/** Index of the match that is exactly selected, or -1. */
export function selectedMatch(view: EditorView): number {
  const { matches, query } = view.state.field(findField);
  const { main } = view.state.selection;
  if (!query || main.to - main.from !== query.needle.length) return -1;
  return matches.indexOf(main.from);
}

/** Replaces the selected match (or selects the next one first). */
export function replaceSelected(view: EditorView, replacement: string): void {
  if (selectedMatch(view) < 0) {
    selectMatch(view, 1);
    return;
  }
  const { main } = view.state.selection;
  view.dispatch({
    changes: { from: main.from, to: main.to, insert: replacement },
    selection: EditorSelection.cursor(main.from + replacement.length),
    userEvent: 'input.replace',
  });
  selectMatch(view, 1);
}

/** Replaces every match in one undo step. Returns how many. */
export function replaceAll(view: EditorView, replacement: string): number {
  const { matches, query } = view.state.field(findField);
  if (!query || matches.length === 0) return 0;
  view.dispatch({
    changes: matches.map((from) => ({ from, to: from + query.needle.length, insert: replacement })),
    userEvent: 'input.replace.all',
  });
  return matches.length;
}
