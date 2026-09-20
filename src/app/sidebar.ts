import type { DocumentInfo } from './documents';

export interface SidebarConfig {
  parent: HTMLElement;
  onOpen(id: string): void;
  onRename(id: string, currentTitle: string): void;
  onDelete(id: string, title: string): void;
}

export interface Sidebar {
  render(documents: DocumentInfo[]): void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function button(className: string, label: string, title = ''): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  if (title) node.title = title;
  return node;
}

/** The list of documents stored in this browser, newest first. */
export function createSidebar(config: SidebarConfig): Sidebar {
  const heading = document.createElement('h2');
  heading.className = 'chart-title';
  heading.textContent = 'Documents in this browser';
  const list = document.createElement('ul');
  list.className = 'doc-list';
  config.parent.append(heading, list);

  return {
    render(documents) {
      list.replaceChildren(
        ...documents.map((doc) => {
          const item = document.createElement('li');
          item.className = doc.current ? 'doc-item is-current' : 'doc-item';
          item.dataset.id = doc.id;

          const open = button('doc-open', '');
          if (doc.current) open.setAttribute('aria-current', 'true');
          const title = document.createElement('span');
          title.className = 'doc-title';
          title.textContent = doc.title;
          const date = document.createElement('span');
          date.className = 'doc-date';
          date.textContent = dateFormat.format(doc.updatedAt);
          open.append(title, date);
          open.addEventListener('click', () => config.onOpen(doc.id));

          const rename = button('doc-rename', 'Rename');
          rename.setAttribute('aria-label', `Rename ${doc.title}`);
          rename.addEventListener('click', () => config.onRename(doc.id, doc.title));

          const remove = button('doc-delete', 'Delete');
          remove.setAttribute('aria-label', `Delete ${doc.title}`);
          remove.addEventListener('click', () => config.onDelete(doc.id, doc.title));

          item.append(open, rename, remove);
          return item;
        }),
      );
    },
  };
}
