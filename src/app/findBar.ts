import type { PalakaEditor } from '../editor/createEditor';
import { findField, replaceAll, replaceSelected, selectMatch, selectedMatch, setFindQuery } from '../editor/editorTools';
import { interpretQuery, replacementFor } from '../editor/findModel';

export interface FindBar {
  open(): void;
  close(): void;
  /** Call on every editor update, so that the count follows the text. */
  refresh(): void;
}

/**
 * Find and replace. Both fields accept Telugu or Palaka-HK roman; the bar always shows the Telugu
 * it is really looking for, so nothing is guessed behind the writer's back.
 */
export function createFindBar(root: HTMLElement, editor: PalakaEditor, flash: (message: string) => void): FindBar {
  const field = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const find = field<HTMLInputElement>('find-text');
  const replace = field<HTMLInputElement>('find-replace');
  const asRoman = field<HTMLInputElement>('find-roman');
  const count = field('find-count');
  const meaning = field('find-meaning');
  const view = editor.view;

  const query = () => interpretQuery(find.value, asRoman.checked, editor.getOptions());
  const replacement = () => replacementFor(query(), replace.value, asRoman.checked, editor.getOptions());

  const refresh = () => {
    if (root.hidden) return;
    const { matches } = view.state.field(findField);
    const current = selectedMatch(view);
    if (find.value === '') count.textContent = '';
    else if (matches.length === 0) count.textContent = 'not found';
    else count.textContent = current >= 0 ? `${current + 1} of ${matches.length}` : `${matches.length} found`;
  };

  const search = () => {
    const q = query();
    view.dispatch({ effects: setFindQuery.of(q.needle ? q : null) });
    // Show what is really searched for whenever it differs from what was typed.
    meaning.textContent = q.needle && q.needle !== find.value ? `${q.needle}${q.open ? '…' : ''}` : '';
    refresh();
  };

  const go = (direction: 1 | -1) => {
    selectMatch(view, direction);
    refresh();
  };

  find.addEventListener('input', search);
  asRoman.addEventListener('change', search);
  find.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    go(event.shiftKey ? -1 : 1);
  });
  replace.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    replaceSelected(view, replacement());
    refresh();
  });
  field('find-next').addEventListener('click', () => go(1));
  field('find-previous').addEventListener('click', () => go(-1));
  field('find-replace-one').addEventListener('click', () => {
    replaceSelected(view, replacement());
    refresh();
  });
  field('find-replace-all').addEventListener('click', () => {
    const done = replaceAll(view, replacement());
    flash(done === 1 ? '1 replaced' : `${done} replaced`);
    refresh();
  });

  const close = () => {
    if (root.hidden) return;
    root.hidden = true;
    view.dispatch({ effects: setFindQuery.of(null) });
    view.focus();
  };
  field('find-close').addEventListener('click', close);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  return {
    open() {
      root.hidden = false;
      find.focus();
      find.select();
      search();
    },
    close,
    refresh,
  };
}
