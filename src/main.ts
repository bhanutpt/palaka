import '@fontsource-variable/noto-sans-telugu';
import '@fontsource-variable/noto-serif-telugu';
import './app/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { DocumentManager } from './app/documents';
import { copyText, downloadText, readTextFile } from './app/files';
import { applySettings, loadSettings, saveSettings } from './app/settings';
import { createSettingsDialog } from './app/settingsDialog';
import { createSidebar } from './app/sidebar';
import { createStatusBar } from './app/statusBar';
import { DocumentStore } from './app/storage';
import { createChartPanel } from './chart/chartPanel';
import { createEditor, type PalakaEditor } from './editor/createEditor';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let settings = loadSettings(localStorage);
applySettings(settings);

const statusBar = createStatusBar(byId('status'));
const modeToggle = byId('mode-toggle');

// The chart is created first; its callbacks only run on a click, when the editor exists.
const chart = createChartPanel({
  parent: byId('chart'),
  onInsert: (text) => editor.insert(text),
  onReplace: (expected, text) => editor.replaceBefore(expected, text),
  onDone: () => editor.view.focus(),
});

// True while text is being put into the editor by the app itself, which is not an edit to save.
let loading = true;
const editor: PalakaEditor = createEditor({
  parent: byId('editor'),
  shortcut: settings.shortcut,
  onStatus(status) {
    const telugu = status.mode === 'telugu';
    modeToggle.textContent = telugu ? 'తెలుగు' : 'English';
    modeToggle.setAttribute('aria-pressed', String(telugu));

    chart.editorChanged();
    chart.setTyped(status.typedKey ? (status.typedKey.asSign ? 'sign:' : '') + status.typedKey.key : null);
    chart.setCursorText(status.typedKey ? '' : (status.syllable?.text ?? ''));
    statusBar.update(status, () => editor.getText());
    if (status.docChanged && !loading) documents.textChanged();
  },
});
editor.setOptions({ teluguDigits: settings.teluguDigits });

// Documents and autosave

const documents = new DocumentManager(new DocumentStore(), localStorage, {
  getText: () => editor.getText(),
  load(text) {
    loading = true;
    editor.load(text);
    loading = false;
  },
});
loading = false;

const sidebar = createSidebar({
  parent: byId('documents'),
  onOpen: (id) => void documents.open(id).then(() => editor.view.focus()),
  onRename(id, title) {
    const name = window.prompt('Name of the document', title);
    if (name !== null) void documents.rename(id, name);
  },
  onDelete(id, title) {
    if (window.confirm(`Delete "${title}" from this browser? This cannot be undone.`)) void documents.remove(id);
  },
});

documents.onChange = () => {
  sidebar.render(documents.list());
  statusBar.setSaved(documents.saved);
  document.title = `${documents.currentTitle} — పలక!`;
};

// A closing tab may not wait for IndexedDB, so the text also goes into a synchronous draft.
const saveNow = () => {
  documents.writeDraft();
  void documents.flush();
};
window.addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveNow();
});

// Toolbar

const toggle = (button: HTMLElement, className: string, expandedWhenSet: boolean) => {
  const set = document.body.classList.toggle(className);
  button.setAttribute('aria-expanded', String(set === expandedWhenSet));
  editor.view.focus();
};

modeToggle.addEventListener('click', () => editor.toggleMode());
byId('chart-toggle').addEventListener('click', (event) => toggle(event.currentTarget as HTMLElement, 'chart-hidden', false));
byId('docs-toggle').addEventListener('click', (event) => {
  toggle(event.currentTarget as HTMLElement, 'documents-open', true);
  byId('documents').hidden = !document.body.classList.contains('documents-open');
});

byId('doc-new').addEventListener('click', () => void documents.create().then(() => editor.view.focus()));
byId('doc-save').addEventListener('click', () => downloadText(documents.currentTitle, editor.getText()));
byId('copy-all').addEventListener('click', () => {
  void copyText(editor.getText()).then((ok) => statusBar.flash(ok ? 'Copied' : 'Copy failed'));
});

const fileInput = byId<HTMLInputElement>('file-input');
byId('doc-open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  void readTextFile(file)
    .then((text) => documents.importText(file.name, text))
    .then(() => editor.view.focus());
});

const settingsDialog = createSettingsDialog(byId<HTMLDialogElement>('settings'), settings, (next) => {
  settings = next;
  saveSettings(localStorage, settings);
  applySettings(settings);
  editor.setOptions({ teluguDigits: settings.teluguDigits });
  editor.setShortcut(settings.shortcut);
});
byId('settings-open').addEventListener('click', () => settingsDialog.open());

void documents.start().then(() => editor.view.focus());

// Offline: the service worker caches the whole app on the first visit.
registerSW({ immediate: true });
