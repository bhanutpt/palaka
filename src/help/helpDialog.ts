import { schemeData } from '../engine';
import { buildHelp } from './helpModel';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

/** Text with `keys` in backticks and **strong** parts, as DOM nodes. */
function rich(text: string): Node[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/).map((part) => {
    if (part.startsWith('`')) return el('code', part.slice(1, -1));
    if (part.startsWith('**')) return el('strong', part.slice(2, -2));
    return document.createTextNode(part);
  });
}

function table(head: string[], rows: (string | Node)[][]): HTMLTableElement {
  const node = el('table');
  const headRow = el('tr');
  headRow.append(...head.map((h) => el('th', h)));
  node.append(headRow);
  for (const row of rows) {
    const tr = el('tr');
    for (const cell of row) {
      const td = el('td');
      td.append(cell);
      tr.append(td);
    }
    node.append(tr);
  }
  return node;
}

/** Fills the help dialog from the mapping file. It is rebuilt on every opening, so it shows the current shortcut. */
export function createHelpDialog(dialog: HTMLDialogElement, getShortcut: () => string): { open(): void } {
  const body = dialog.querySelector<HTMLElement>('#help-body')!;

  const render = () => {
    const help = buildHelp(schemeData, getShortcut().replace('-', '+'));
    const parts: Node[] = [el('h2', help.title), ...help.intro.map((text) => el('p', text))];

    parts.push(el('h3', 'Examples'));
    parts.push(table(['Typed', 'Result'], help.examples.map((e) => [el('code', e.roman), el('span', e.telugu, 'help-telugu')])));

    parts.push(el('h3', 'The keys'));
    for (const section of help.sections) {
      const tiles = section.rows.flat();
      const heading = el('h4', [section.titleTelugu, section.title].filter(Boolean).join(' · '));
      parts.push(
        heading,
        table(['Key', 'Letter', 'Note'], tiles.map((t) => [el('code', t.key), el('span', t.display, 'help-telugu'), t.note])),
      );
    }

    parts.push(el('h3', 'The rules'));
    const rules = el('ol');
    for (const rule of help.rules) {
      const item = el('li');
      item.append(...rich(rule));
      rules.append(item);
    }
    parts.push(rules);

    parts.push(el('h3', 'TRVK mode'));
    for (const note of help.trvk) {
      const paragraph = el('p');
      paragraph.append(...rich(note));
      parts.push(paragraph);
    }

    parts.push(el('h3', 'In the editor'));
    parts.push(table(['Key', 'What it does'], help.tips.map((t) => [el('kbd', t.keys), t.action])));

    body.replaceChildren(...parts);
  };

  return {
    open() {
      render();
      dialog.showModal();
      body.scrollTop = 0;
    },
  };
}
