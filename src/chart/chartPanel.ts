import { schemeData } from '../engine';
import { buildChart, gunintaOf, matchesQuery, tileIdsForText, type Tile } from './chartModel';

export interface ChartPanelConfig {
  parent: HTMLElement;
  /** Insert text at the cursor. */
  onInsert(text: string): void;
  /** Replace `expected` before the cursor with `text`, or insert `text` if it is not there. */
  onReplace(expected: string, text: string): void;
  /** Called after a pointer click, so that the editor can take the focus back. */
  onDone(): void;
  /** Escape was pressed in the chart with nothing left to close: the writer wants to go back to the text. */
  onLeave(): void;
}

export interface ChartPanel {
  /** Lights the tile of the key just typed; null clears it. */
  setTyped(tileId: string | null): void;
  /** Outlines the tiles of the syllable at the cursor. */
  setCursorText(text: string): void;
  /** Call on every editor update: a guninta choice only replaces the letter the chart itself just inserted. */
  editorChanged(): void;
  /** Puts the keyboard focus into the chart, on its search box. */
  focus(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function createChartPanel(config: ChartPanelConfig): ChartPanel {
  const sections = buildChart(schemeData);
  const buttons = new Map<string, HTMLButtonElement>();
  const tiles = new Map<string, Tile>();
  /** Text the chart has just inserted and that still stands before the cursor. */
  let justInserted: string | null = null;
  /** The tile whose guninta is open. */
  let gunintaTile: string | null = null;

  const search = el('input', 'chart-search');
  search.type = 'search';
  search.placeholder = 'Find: key or letter';
  search.setAttribute('aria-label', 'Find a letter by roman key or Telugu letter');
  search.autocapitalize = 'off';
  search.spellcheck = false;

  const body = el('div', 'chart-body');
  const guninta = el('div', 'chart-guninta');
  guninta.hidden = true;
  guninta.setAttribute('aria-live', 'polite');

  // A pointer click hands the focus back to the editor; keyboard users keep their place in the chart.
  const finish = (event: MouseEvent) => {
    if (event.detail > 0) config.onDone();
  };

  function tileButton(className: string, display: string, key: string, label: string): HTMLButtonElement {
    const button = el('button', className);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    const letter = el('span', 'tile-letter', display);
    letter.lang = 'te';
    button.append(letter, el('span', 'tile-key', key));
    // Keep the editor's selection and focus while clicking with the mouse.
    button.addEventListener('mousedown', (event) => event.preventDefault());
    return button;
  }

  /** Closes the guninta; a keyboard user is put back on the tile that opened it. */
  function closeGuninta(opener: HTMLElement | undefined) {
    const hadFocus = guninta.contains(document.activeElement);
    guninta.hidden = true;
    if (hadFocus) opener?.focus();
  }

  function showGuninta(tile: Tile) {
    gunintaTile = tile.id;
    const close = el('button', 'guninta-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close the guninta');
    close.addEventListener('click', () => closeGuninta(buttons.get(tile.id)));

    const cells = el('div', 'chart-grid');
    for (const cell of gunintaOf(tile, schemeData)) {
      const button = tileButton('tile', cell.text, cell.roman, `${cell.text}, typed ${cell.roman}`);
      button.dataset.roman = cell.roman;
      button.addEventListener('click', (event) => {
        if (justInserted !== null) config.onReplace(justInserted, cell.text);
        else config.onInsert(cell.text);
        justInserted = cell.text;
        finish(event);
      });
      cells.append(button);
    }

    const head = el('div', 'guninta-head');
    const name = el('span', '', `${tile.display} గుణింతం`);
    name.lang = 'te';
    head.append(name, close);
    guninta.replaceChildren(head, cells);
    guninta.hidden = false;
  }

  for (const section of sections) {
    const block = el('section', 'chart-section');
    block.dataset.section = section.id;
    const title = el('h2', 'chart-title');
    if (section.titleTelugu) {
      const telugu = el('span', 'chart-title-te', section.titleTelugu);
      telugu.lang = 'te';
      title.append(telugu, ' ');
    }
    title.append(section.title);
    block.append(title);

    for (const row of section.rows) {
      const grid = el('div', 'chart-grid');
      if (section.columns) grid.style.setProperty('--columns', String(section.columns));
      for (const tile of row) {
        const button = tileButton('tile', tile.display, tile.key, tile.label);
        button.dataset.tile = tile.id;
        if (tile.note) button.title = tile.note;
        if (tile.disabled) button.setAttribute('aria-disabled', 'true');
        button.addEventListener('click', (event) => {
          if (!tile.disabled) {
            config.onInsert(tile.insert);
            justInserted = tile.insert;
          }
          if (tile.hasGuninta) showGuninta(tile);
          finish(event);
        });
        buttons.set(tile.id, button);
        tiles.set(tile.id, tile);
        grid.append(button);
      }
      block.append(grid);
    }
    body.append(block);
  }

  search.addEventListener('input', () => {
    for (const [id, button] of buttons) {
      button.classList.toggle('is-dimmed', !matchesQuery(tiles.get(id)!, search.value));
    }
  });

  // Escape closes the guninta first, then leaves the chart. In the search box it first clears the query.
  config.parent.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || (event.target === search && search.value !== '')) return;
    event.preventDefault();
    if (!guninta.hidden) {
      guninta.hidden = true;
      if (gunintaTile) buttons.get(gunintaTile)?.focus();
    } else config.onLeave();
  });

  config.parent.append(search, body, guninta);

  const mark = (className: string, ids: string[]) => {
    for (const button of config.parent.querySelectorAll(`.${className}`)) button.classList.remove(className);
    for (const id of ids) buttons.get(id)?.classList.add(className);
  };

  return {
    setTyped(tileId) {
      mark('is-typed', tileId ? [tileId] : []);
      // A lit tile that is scrolled out of sight teaches nothing.
      if (tileId) buttons.get(tileId)?.scrollIntoView({ block: 'nearest' });
    },
    setCursorText: (text) => mark('is-cursor', tileIdsForText(text, schemeData)),
    editorChanged: () => (justInserted = null),
    focus: () => search.focus(),
  };
}
