import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, fontStack, loadSettings, saveSettings } from '../../src/app/settings';
import type { KeyValueStore } from '../../src/app/storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('settings', () => {
  it('starts from the defaults', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({ theme: 'system', fontSize: 20, teluguDigits: false, shortcut: 'Ctrl-Space' });
  });

  it('round-trips through the store', () => {
    const store = memoryStore();
    saveSettings(store, { ...DEFAULT_SETTINGS, theme: 'dark', teluguDigits: true, fontSize: 26 });
    expect(loadSettings(store)).toMatchObject({ theme: 'dark', teluguDigits: true, fontSize: 26 });
  });

  it('survives damaged or outdated data', () => {
    expect(loadSettings(memoryStore({ 'palaka.settings': '{not json' }))).toEqual(DEFAULT_SETTINGS);
    const odd = JSON.stringify({ theme: 'neon', fontSize: 500, font: 'serif', shortcut: 'Ctrl-Q', extra: 1 });
    expect(loadSettings(memoryStore({ 'palaka.settings': odd }))).toEqual({ ...DEFAULT_SETTINGS, font: 'serif', fontSize: 40 });
  });

  it('builds a font stack that always ends in the bundled fonts', () => {
    expect(fontStack({ ...DEFAULT_SETTINGS, font: 'sans' })).toMatch(/^'Noto Sans Telugu Variable'/);
    expect(fontStack({ ...DEFAULT_SETTINGS, font: 'serif' })).toMatch(/^'Noto Serif Telugu Variable'/);
    expect(fontStack({ ...DEFAULT_SETTINGS, font: 'custom', customFont: "Ramabhadra'; x" })).toBe(
      "'Ramabhadra x', 'Noto Sans Telugu Variable', sans-serif",
    );
    expect(fontStack({ ...DEFAULT_SETTINGS, font: 'custom', customFont: '  ' })).toMatch(/^'Noto Sans Telugu Variable'/);
  });
});
