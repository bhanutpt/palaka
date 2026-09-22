import { FONT_SIZE, TRVK_CONTEXT, type FontChoice, type Settings, type Theme } from './settings';

const clamp = (value: number, fallback: number): number =>
  Number.isFinite(value) ? Math.min(TRVK_CONTEXT.max, Math.max(TRVK_CONTEXT.min, Math.round(value))) : fallback;

/** Wires the settings dialog in index.html. Every change applies at once; there is nothing to confirm. */
export function createSettingsDialog(
  dialog: HTMLDialogElement,
  initial: Settings,
  onChange: (settings: Settings) => void,
): { open(): void } {
  let settings = { ...initial };
  const field = <T extends HTMLElement>(id: string) => dialog.querySelector<T>(`#${id}`)!;

  const theme = field<HTMLSelectElement>('set-theme');
  const font = field<HTMLSelectElement>('set-font');
  const customFont = field<HTMLInputElement>('set-custom-font');
  const customFontRow = field<HTMLElement>('set-custom-font-row');
  const fontSize = field<HTMLInputElement>('set-font-size');
  const digits = field<HTMLInputElement>('set-digits');
  const shortcut = field<HTMLSelectElement>('set-shortcut');
  const trvk = field<HTMLInputElement>('set-trvk');
  const trvkRecorrect = field<HTMLInputElement>('set-trvk-recorrect');
  const trvkContext = field<HTMLInputElement>('set-trvk-context');

  const show = () => {
    theme.value = settings.theme;
    font.value = settings.font;
    customFont.value = settings.customFont;
    customFontRow.hidden = settings.font !== 'custom';
    fontSize.value = String(settings.fontSize);
    digits.checked = settings.teluguDigits;
    shortcut.value = settings.shortcut;
    trvk.checked = settings.trvk;
    trvkRecorrect.checked = settings.trvkRecorrect;
    trvkContext.value = String(settings.trvkContext);
  };

  const read = () => {
    const size = Number(fontSize.value);
    settings = {
      theme: theme.value as Theme,
      font: font.value as FontChoice,
      customFont: customFont.value,
      fontSize: Number.isFinite(size) && size > 0 ? Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size))) : settings.fontSize,
      teluguDigits: digits.checked,
      shortcut: shortcut.value,
      trvk: trvk.checked,
      trvkRecorrect: trvkRecorrect.checked,
      trvkContext: clamp(Number(trvkContext.value), settings.trvkContext),
    };
    customFontRow.hidden = settings.font !== 'custom';
    onChange(settings);
  };

  for (const control of [theme, font, customFont, fontSize, digits, shortcut, trvk, trvkRecorrect, trvkContext]) {
    control.addEventListener('change', read);
  }

  return {
    open() {
      show();
      dialog.showModal();
    },
  };
}
