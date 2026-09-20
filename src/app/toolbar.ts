/**
 * Keyboard behaviour of a toolbar (WAI-ARIA pattern): Tab reaches the toolbar once and moves on;
 * the arrow keys, Home and End walk its buttons. The last button used is the one Tab comes back to.
 */
export function rovingToolbar(root: HTMLElement): void {
  const items = () => [...root.querySelectorAll<HTMLElement>('button')].filter((button) => button.offsetParent !== null);
  const setCurrent = (current: HTMLElement) => {
    for (const item of root.querySelectorAll<HTMLElement>('button')) item.tabIndex = item === current ? 0 : -1;
  };

  const first = items()[0];
  if (first) setCurrent(first);

  root.addEventListener('focusin', (event) => {
    if (event.target instanceof HTMLButtonElement) setCurrent(event.target);
  });
  root.addEventListener('keydown', (event) => {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    let next: number;
    if (event.key === 'ArrowRight') next = (at + 1) % all.length;
    else if (event.key === 'ArrowLeft') next = (at - 1 + all.length) % all.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = all.length - 1;
    else return;
    event.preventDefault();
    all[next].focus();
  });
}
