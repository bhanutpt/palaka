import '@fontsource-variable/noto-sans-telugu';
import '@fontsource-variable/noto-serif-telugu';
import './app/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { createConvertDialog } from './app/convertDialog';
import { DocumentManager } from './app/documents';
import { copyText, downloadText, readTextFile } from './app/files';
import { createFindBar } from './app/findBar';
import { applySettings, loadSettings, saveSettings } from './app/settings';
import { createSettingsDialog } from './app/settingsDialog';
import { createSidebar } from './app/sidebar';
import { createStatusBar } from './app/statusBar';
import { DocumentStore } from './app/storage';
import { rovingToolbar } from './app/toolbar';
import { createChartPanel } from './chart/chartPanel';
import { createEditor, type PalakaEditor } from './editor/createEditor';
import { createRomanPane } from './editor/romanPane';
import { toRoman } from './engine';
import { createHelpDialog } from './help/helpDialog';
import { TrvkModel } from './trvk';

const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let settings = loadSettings(localStorage);
applySettings(settings);

const statusBar = createStatusBar(byId('status'));
const modeToggle = byId('mode-toggle');

// TRVK mode: nothing is downloaded, and no worker exists, until the writer switches the mode
// on for the first time. A failed load leaves the app exactly as it was.
const megabytes = (bytes: number) => (bytes / 1e6).toFixed(1);
const trvk = new TrvkModel({
  onState(state, error) {
    if (state === 'ready') {
      statusBar.setModel(`TRVK ready`);
      window.setTimeout(() => trvk.state === 'ready' && statusBar.setModel(''), 3000);
    } else if (state === 'unavailable') {
      statusBar.setModel('TRVK unavailable');
      statusBar.flash(`TRVK could not start: ${error ?? 'unknown reason'}`);
      // The mode cannot work without it, so the writer goes back to typing Palaka-HK.
      // Deferred: this can arrive while the editor is in the middle of an update.
      window.setTimeout(() => editor.setMode('telugu'), 0);
    } else if (state === 'idle') {
      statusBar.setModel('');
    }
  },
  onProgress(loaded, total) {
    statusBar.setModel(`Downloading TRVK ${megabytes(loaded)} / ${megabytes(total)} MB`);
  },
});

const MODE_LABEL = { telugu: 'తెలుగు', trvk: 'TRVK', english: 'English' } as const;
const MODE_TITLE = {
  telugu: 'తెలుగు: typing Telugu in Palaka-HK',
  trvk: 'TRVK: typing loose roman, corrected as you type',
  english: 'English: typing English',
} as const;

// The chart is created first; its callbacks only run on a click, when the editor exists.
// On a narrow screen the chart is a drawer that slides up from the bottom; it starts closed.
const narrow = window.matchMedia('(max-width: 800px)');
if (narrow.matches) document.body.classList.add('chart-hidden');

const chart = createChartPanel({
  parent: byId('chart-panel'),
  onInsert: (text) => editor.insert(text),
  onReplace: (expected, text) => editor.replaceBefore(expected, text),
  // In the drawer the tiles are the keyboard: taking the focus would bring the on-screen keyboard up over them.
  onDone: () => {
    if (!narrow.matches) editor.view.focus();
  },
  onLeave: () => editor.view.focus(),
});

// True while text is being put into the editor by the app itself, which is not an edit to save.
let loading = true;
const editor: PalakaEditor = createEditor({
  parent: byId('editor'),
  shortcut: settings.shortcut,
  trvk: {
    correct: (text) => trvk.correct(text),
    ready: () => trvk.state === 'ready',
    recorrect: () => settings.trvkRecorrect,
    context: () => settings.trvkContext,
  },
  onStatus(status) {
    modeToggle.textContent = MODE_LABEL[status.mode];
    modeToggle.setAttribute('aria-label', MODE_TITLE[status.mode]);
    // The first switch into TRVK mode is what starts the download.
    if (status.mode === 'trvk' && trvk.state === 'idle') void trvk.load();

    chart.editorChanged();
    chart.setTyped(status.typedKey ? (status.typedKey.asSign ? 'sign:' : '') + status.typedKey.key : null);
    chart.setCursorText(status.typedKey ? '' : (status.syllable?.text ?? ''));
    statusBar.update(status, () => editor.getText());
    if (!loading) findBar.refresh();
    if (status.docChanged && !loading) documents.textChanged();
  },
  onDocChange: (update) => romanPane.teluguChanged(update),
  onFind: () => findBar.open(),
  onHelp: () => help.open(),
});

/** TRVK joins the typing switch when the writer asks for it, and gives up its worker when
 *  they take it away again. */
function applyTrvkSetting(): void {
  editor.setModes(settings.trvk ? ['telugu', 'trvk', 'english'] : ['telugu', 'english']);
  if (!settings.trvk) trvk.terminate();
}

// Verification tools: split roman view, find and replace, bulk convert, help

const romanPane = createRomanPane(byId('roman'), editor.view, () => editor.getOptions());
const findBar = createFindBar(byId('find'), editor, (message) => statusBar.flash(message));
const help = createHelpDialog(byId<HTMLDialogElement>('help'), () => settings.shortcut);
const convertDialog = createConvertDialog(
  byId<HTMLDialogElement>('convert'),
  () => editor.getOptions(),
  (telugu) => {
    editor.insert(telugu);
    editor.view.focus();
  },
);
editor.setOptions({ teluguDigits: settings.teluguDigits });
applyTrvkSetting();

// Documents and autosave

const documents = new DocumentManager(new DocumentStore(), localStorage, {
  getText: () => editor.getText(),
  load(text) {
    loading = true;
    editor.load(text);
    loading = false;
    romanPane.refresh();
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
  document.title = `${documents.currentTitle} — పలక`;
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

rovingToolbar(byId('tools'));

/** Shows or hides the chart: the side panel on a wide screen, the drawer on a narrow one. */
const setChart = (open: boolean) => {
  document.body.classList.toggle('chart-hidden', !open);
  // The slide is only animated once the writer has asked for it, not while the page loads.
  document.body.classList.add('chart-moved');
  for (const id of ['chart-toggle', 'chart-handle']) byId(id).setAttribute('aria-expanded', String(open));
};
const chartOpen = () => !document.body.classList.contains('chart-hidden');
for (const id of ['chart-toggle', 'chart-handle']) byId(id).setAttribute('aria-expanded', String(chartOpen()));

modeToggle.addEventListener('click', () => editor.toggleMode());
byId('chart-toggle').addEventListener('click', () => {
  setChart(!chartOpen());
  editor.view.focus();
});
byId('chart-handle').addEventListener('click', () => setChart(!chartOpen()));
byId('docs-toggle').addEventListener('click', (event) => {
  const open = document.body.classList.toggle('documents-open');
  (event.currentTarget as HTMLElement).setAttribute('aria-expanded', String(open));
  byId('documents').hidden = !open;
  editor.view.focus();
});

// F6 moves between the text and the chart, opening the chart if need be.
window.addEventListener('keydown', (event) => {
  if (event.key !== 'F6' || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  if (byId('chart').contains(document.activeElement)) editor.view.focus();
  else {
    setChart(true);
    chart.focus();
  }
});

const press = (button: HTMLElement, on: boolean) => button.setAttribute('aria-pressed', String(on));

byId('split-toggle').addEventListener('click', (event) => {
  const roman = byId('roman');
  roman.hidden = !roman.hidden;
  press(event.currentTarget as HTMLElement, !roman.hidden);
  romanPane.setActive(!roman.hidden);
  editor.view.focus();
});
byId('inspect-toggle').addEventListener('click', (event) => {
  const button = event.currentTarget as HTMLElement;
  const on = button.getAttribute('aria-pressed') !== 'true';
  press(button, on);
  editor.setInspector(on);
  editor.view.focus();
});
byId('find-open').addEventListener('click', () => findBar.open());
byId('convert-open').addEventListener('click', () => convertDialog.open());
byId('help-open').addEventListener('click', () => help.open());
byId('copy-roman').addEventListener('click', () => {
  const roman = toRoman(editor.getSelectionOrAll(), editor.getOptions());
  void copyText(roman).then((ok) => statusBar.flash(ok ? 'Roman copied' : 'Copy failed'));
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
  applyTrvkSetting();
  romanPane.refresh();
});
byId('settings-open').addEventListener('click', () => settingsDialog.open());

void documents.start().then(() => editor.view.focus());

// Offline: the service worker caches the whole app on the first visit.
registerSW({ immediate: true });
