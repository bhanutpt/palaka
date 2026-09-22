import type { KeyValueStore } from './storage';

export type Theme = 'system' | 'light' | 'dark';
export type FontChoice = 'sans' | 'serif' | 'custom';

export interface Settings {
  theme: Theme;
  font: FontChoice;
  /** Name of a font installed on this computer; used when `font` is custom. */
  customFont: string;
  fontSize: number;
  teluguDigits: boolean;
  /** CodeMirror key name of the Telugu/English switch. */
  shortcut: string;
  /** TRVK mode: loose roman corrected by the model. Off until the writer asks for it. */
  trvk: boolean;
  /** Correct a word once more when the next word appears. */
  trvkRecorrect: boolean;
  /** Words of context the model is given on each side. */
  trvkContext: number;
}

export const SHORTCUTS = ['Ctrl-Space', 'Ctrl-.', 'F9'] as const;
export const FONT_SIZE = { min: 14, max: 40 } as const;
export const TRVK_CONTEXT = { min: 1, max: 3 } as const;

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  font: 'sans',
  customFont: '',
  fontSize: 20,
  teluguDigits: false,
  shortcut: 'Ctrl-Space',
  trvk: false,
  trvkRecorrect: true,
  trvkContext: 3,
};

const KEY = 'palaka.settings';
const SANS = "'Noto Sans Telugu Variable'";
const SERIF = "'Noto Serif Telugu Variable'";

const oneOf = <T>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Reads the settings, replacing anything missing or invalid with its default. */
export function loadSettings(store: KeyValueStore): Settings {
  let raw: Partial<Record<keyof Settings, unknown>> = {};
  try {
    raw = (JSON.parse(store.getItem(KEY) ?? '{}') as typeof raw | null) ?? {};
  } catch {
    // Damaged data: fall back to the defaults.
  }
  const d = DEFAULT_SETTINGS;
  const size = typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize) ? raw.fontSize : d.fontSize;
  const context = typeof raw.trvkContext === 'number' && Number.isFinite(raw.trvkContext) ? raw.trvkContext : d.trvkContext;
  return {
    theme: oneOf<Theme>(raw.theme, ['system', 'light', 'dark'], d.theme),
    font: oneOf<FontChoice>(raw.font, ['sans', 'serif', 'custom'], d.font),
    customFont: typeof raw.customFont === 'string' ? raw.customFont : d.customFont,
    fontSize: Math.min(FONT_SIZE.max, Math.max(FONT_SIZE.min, Math.round(size))),
    teluguDigits: raw.teluguDigits === true,
    shortcut: oneOf<string>(raw.shortcut, SHORTCUTS, d.shortcut),
    trvk: raw.trvk === true,
    trvkRecorrect: raw.trvkRecorrect !== false,
    trvkContext: Math.min(TRVK_CONTEXT.max, Math.max(TRVK_CONTEXT.min, Math.round(context))),
  };
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  store.setItem(KEY, JSON.stringify(settings));
}

/** CSS font-family value. The bundled fonts always come last, so Telugu renders even if a custom font is missing. */
export function fontStack(settings: Settings): string {
  const custom = settings.customFont
    .replace(/[^\p{L}\p{M}\p{N} _-]/gu, '')
    .replace(/ +/g, ' ')
    .trim();
  if (settings.font === 'custom' && custom) return `'${custom}', ${SANS}, sans-serif`;
  return settings.font === 'serif' ? `${SERIF}, ${SANS}, serif` : `${SANS}, sans-serif`;
}

/** Applies theme, font and size to the page. */
export function applySettings(settings: Settings, root: HTMLElement = document.documentElement): void {
  if (settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = settings.theme;
  root.style.setProperty('--telugu-font', fontStack(settings));
  root.style.setProperty('--editor-size', `${settings.fontSize}px`);
}
