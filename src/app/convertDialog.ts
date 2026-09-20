import { convert, type ConvertOptions } from '../engine';

/**
 * Bulk convert: paste a block of Palaka-HK text typed elsewhere, check the Telugu, insert it at once.
 * The preview is the engine's own output, so what is shown is what gets inserted.
 */
export function createConvertDialog(
  dialog: HTMLDialogElement,
  getOptions: () => ConvertOptions,
  onInsert: (telugu: string) => void,
): { open(): void } {
  const field = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;
  const roman = field<HTMLTextAreaElement>('convert-roman');
  const preview = field('convert-preview');
  const warning = field('convert-warning');

  const update = () => {
    const result = convert(roman.value, getOptions());
    preview.textContent = result.text;
    const letters = [...new Set(result.unmapped.map((u) => u.char))];
    warning.textContent = letters.length > 0 ? `Not Palaka-HK keys, copied as they are: ${letters.join(' ')}` : '';
  };
  roman.addEventListener('input', update);

  field('convert-insert').addEventListener('click', () => {
    const text = convert(roman.value, getOptions()).text;
    if (text) onInsert(text);
    roman.value = '';
  });

  return {
    open() {
      update();
      dialog.showModal();
      roman.focus();
    },
  };
}
