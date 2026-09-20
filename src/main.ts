import './app/styles.css';
import { createStatusBar } from './app/statusBar';
import { createChartPanel } from './chart/chartPanel';
import { createEditor, type PalakaEditor } from './editor/createEditor';

// Shell for phases 2 and 3: editor, chart, mode switch and status bar.
// Documents, settings and the full toolbar arrive in phase 4.
const byId = (id: string) => document.getElementById(id)!;
const modeToggle = byId('mode-toggle');
const chartToggle = byId('chart-toggle');
const statusBar = createStatusBar(byId('status'));

// The chart is created first; its callbacks only run on a click, when the editor exists.
const chart = createChartPanel({
  parent: byId('chart'),
  onInsert: (text) => editor.insert(text),
  onReplace: (expected, text) => editor.replaceBefore(expected, text),
  onDone: () => editor.view.focus(),
});

const editor: PalakaEditor = createEditor({
  parent: byId('editor'),
  onStatus(status) {
    const telugu = status.mode === 'telugu';
    modeToggle.textContent = telugu ? 'తెలుగు' : 'English';
    modeToggle.setAttribute('aria-pressed', String(telugu));

    chart.editorChanged();
    chart.setTyped(status.typedKey ? (status.typedKey.asSign ? 'sign:' : '') + status.typedKey.key : null);
    chart.setCursorText(status.typedKey ? '' : (status.syllable?.text ?? ''));
    statusBar.update(status, () => editor.getText());
  },
});

modeToggle.addEventListener('click', () => editor.toggleMode());

chartToggle.addEventListener('click', () => {
  const hidden = document.body.classList.toggle('chart-hidden');
  chartToggle.setAttribute('aria-expanded', String(!hidden));
  editor.view.focus();
});

editor.view.focus();
