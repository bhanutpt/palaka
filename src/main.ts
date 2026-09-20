import './app/styles.css';
import { createEditor } from './editor/createEditor';

// Phase 2 shell: editor, mode switch and a minimal status line.
// The chart, the full status bar and the toolbar arrive in phases 3 and 4.
const byId = (id: string) => document.getElementById(id)!;
const modeToggle = byId('mode-toggle');

const editor = createEditor({
  parent: byId('editor'),
  onStatus(status) {
    const telugu = status.mode === 'telugu';
    modeToggle.textContent = telugu ? 'తెలుగు' : 'English';
    modeToggle.setAttribute('aria-pressed', String(telugu));
    byId('status-mode').textContent = telugu ? 'Palaka-HK' : 'English';
    byId('status-echo').textContent = status.echo;
    byId('status-warning').textContent =
      status.unmapped.length > 0 ? `Not a Palaka-HK key: ${status.unmapped.join(' ')}` : '';
  },
});

modeToggle.addEventListener('click', () => editor.toggleMode());
editor.view.focus();
