import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorSelection, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, keymap } from '@codemirror/view';
import { normalise, type ConvertOptions } from '../engine';
import { lastKeyOf, type TypedKey } from './composer';
import { syllableBefore, type Syllable } from './inspect';
import {
  capsLockField,
  convertOptions,
  liveField,
  liveTyping,
  modeField,
  modeShortcut,
  setMode,
  toggleMode,
  unmappedField,
  type InputMode,
} from './liveTyping';

export interface EditorStatus {
  mode: InputMode;
  /** Roman keys of the syllable in progress. */
  echo: string;
  /** Unmapped letters of the latest keystroke. */
  unmapped: string[];
  capsLock: boolean;
  /** The key just typed, while its syllable is live. */
  typedKey: TypedKey | null;
  /** The written syllable before the cursor. */
  syllable: Syllable | null;
  /** True when this update changed the text. */
  docChanged: boolean;
}

export interface PalakaEditor {
  view: EditorView;
  getText(): string;
  setText(text: string): void;
  setMode(mode: InputMode): void;
  toggleMode(): void;
  setOptions(options: ConvertOptions): void;
  /** Changes the key of the Telugu/English switch (a CodeMirror key name such as Ctrl-Space). */
  setShortcut(key: string): void;
  /** Replaces the whole text and starts a fresh undo history; mode and settings are kept. */
  load(text: string): void;
  /** Inserts text at the cursor, replacing the selection. */
  insert(text: string): void;
  /** Replaces `expected` with `text` if it stands right before the cursor; otherwise just inserts `text`. */
  replaceBefore(expected: string, text: string): void;
}

export interface EditorConfig {
  parent: HTMLElement;
  doc?: string;
  shortcut?: string;
  onStatus?: (status: EditorStatus) => void;
}

function readStatus(state: EditorState, docChanged: boolean): EditorStatus {
  const live = state.field(liveField);
  const { main } = state.selection;
  const line = state.doc.lineAt(main.head);
  const syllable = main.empty ? syllableBefore(line.text, main.head - line.from) : null;
  return {
    mode: state.field(modeField),
    echo: live?.roman ?? '',
    unmapped: state.field(unmappedField),
    capsLock: state.field(capsLockField),
    typedKey: live ? lastKeyOf(live.roman, state.facet(convertOptions)) : null,
    syllable: syllable && { ...syllable, from: syllable.from + line.from, to: syllable.to + line.from },
    docChanged,
  };
}

export function createEditor(config: EditorConfig): PalakaEditor {
  const options = new Compartment();
  const shortcut = new Compartment();
  let currentOptions: ConvertOptions = {};
  let currentShortcut = config.shortcut ?? 'Ctrl-Space';

  const createState = (doc: string) =>
    EditorState.create({
      doc: normalise(doc),
      extensions: [
        liveTyping(),
        options.of(convertOptions.of(currentOptions)),
        shortcut.of(modeShortcut(currentShortcut)),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        drawSelection(),
        EditorView.lineWrapping,
        // The scheme is case-sensitive: a keyboard that capitalises or corrects would change letters.
        EditorView.contentAttributes.of({
          autocapitalize: 'off',
          autocorrect: 'off',
          spellcheck: 'false',
          lang: 'te',
          'aria-label': 'Telugu editor',
        }),
        EditorView.clipboardInputFilter.of((text) => normalise(text)),
        EditorView.updateListener.of((update) => {
          if (update.transactions.length > 0) config.onStatus?.(readStatus(update.state, update.docChanged));
        }),
      ],
    });

  const view = new EditorView({ parent: config.parent, state: createState(config.doc ?? '') });
  config.onStatus?.(readStatus(view.state, true));

  const insert = (text: string, from: number, to: number) =>
    view.dispatch({
      changes: { from, to, insert: text },
      selection: EditorSelection.cursor(from + text.length),
      userEvent: 'input',
      scrollIntoView: true,
    });

  return {
    view,
    getText: () => view.state.doc.toString(),
    setText(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: normalise(text) } });
    },
    setMode(mode) {
      view.dispatch({ effects: setMode.of(mode) });
      view.focus();
    },
    toggleMode() {
      toggleMode(view);
      view.focus();
    },
    insert(text) {
      const { main } = view.state.selection;
      insert(text, main.from, main.to);
    },
    replaceBefore(expected, text) {
      const { main } = view.state.selection;
      const from = main.head - expected.length;
      const stands = main.empty && from >= 0 && view.state.sliceDoc(from, main.head) === expected;
      insert(text, stands ? from : main.from, main.to);
    },
    setOptions(next) {
      currentOptions = next;
      view.dispatch({ effects: options.reconfigure(convertOptions.of(next)) });
    },
    setShortcut(key) {
      currentShortcut = key;
      view.dispatch({ effects: shortcut.reconfigure(modeShortcut(key)) });
    },
    load(text) {
      const mode = view.state.field(modeField);
      view.setState(createState(text));
      view.dispatch({ effects: setMode.of(mode) });
      config.onStatus?.(readStatus(view.state, true));
    },
  };
}
