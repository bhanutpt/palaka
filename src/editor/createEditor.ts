import { defaultKeymap, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, drawSelection, keymap } from '@codemirror/view';
import { normalise, type ConvertOptions } from '../engine';
import {
  convertOptions,
  liveField,
  liveTyping,
  modeField,
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
}

export interface PalakaEditor {
  view: EditorView;
  getText(): string;
  setText(text: string): void;
  setMode(mode: InputMode): void;
  toggleMode(): void;
  setOptions(options: ConvertOptions): void;
}

export interface EditorConfig {
  parent: HTMLElement;
  doc?: string;
  shortcut?: string;
  onStatus?: (status: EditorStatus) => void;
}

const readStatus = (state: EditorState): EditorStatus => ({
  mode: state.field(modeField),
  echo: state.field(liveField)?.roman ?? '',
  unmapped: state.field(unmappedField),
});

export function createEditor(config: EditorConfig): PalakaEditor {
  const options = new Compartment();

  const view = new EditorView({
    parent: config.parent,
    state: EditorState.create({
      doc: normalise(config.doc ?? ''),
      extensions: [
        liveTyping(config.shortcut),
        options.of(convertOptions.of({})),
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
          if (update.transactions.length > 0) config.onStatus?.(readStatus(update.state));
        }),
      ],
    }),
  });
  config.onStatus?.(readStatus(view.state));

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
    setOptions(next) {
      view.dispatch({ effects: options.reconfigure(convertOptions.of(next)) });
    },
  };
}
