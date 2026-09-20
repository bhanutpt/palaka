import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** WCAG 2 contrast of the two palettes, read from the stylesheet itself so that it cannot drift. */

const css = readFileSync('src/app/styles.css', 'utf8');

function palette(selector: string): Record<string, string> {
  const start = css.indexOf(selector + ' {');
  if (start < 0) throw new Error(`no ${selector} block in styles.css`);
  const block = css.slice(start, css.indexOf('}', start));
  const colours: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)) colours[name] = value;
  return colours;
}

function luminance(hex: string): number {
  const channel = (at: number) => {
    const c = parseInt(hex.slice(at, at + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Alpha-blends `top` over `bottom`, as color-mix(in srgb, top X%, transparent) over a background does. */
function blend(top: string, bottom: string, alpha: number): string {
  const mix = (at: number) => {
    const value = Math.round(parseInt(top.slice(at, at + 2), 16) * alpha + parseInt(bottom.slice(at, at + 2), 16) * (1 - alpha));
    return value.toString(16).padStart(2, '0');
  };
  return `#${mix(1)}${mix(3)}${mix(5)}`;
}

const AA_TEXT = 4.5;
const AA_UI = 3;

describe.each([
  ['light', ':root'],
  ['dark', ":root[data-theme='dark']"],
])('%s palette', (_name, selector) => {
  const c = palette(selector);

  it('defines every colour', () => {
    for (const name of ['bg', 'panel', 'text', 'muted', 'accent', 'on-accent', 'warning', 'border', 'selection']) {
      expect(c[name], name).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each([
    ['text', 'bg'],
    ['text', 'panel'],
    ['text', 'selection'],
    ['muted', 'bg'],
    ['muted', 'panel'],
    ['accent', 'bg'],
    ['accent', 'panel'],
    ['warning', 'bg'],
    ['warning', 'panel'],
    ['on-accent', 'accent'],
  ])('%s on %s meets AA for text', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('text stays readable on a find match and on an inspector mark', () => {
    expect(contrast(c.text, blend(c.accent, c.bg, 0.22))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(c.text, blend(c.warning, c.bg, 0.2))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('the focus ring and the highlighted tile border stand out from the page', () => {
    expect(contrast(c.accent, c.bg)).toBeGreaterThanOrEqual(AA_UI);
    expect(contrast(c.accent, c.panel)).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe('the system-dark palette', () => {
  it('is the same as the chosen dark palette', () => {
    expect(palette(':root:not([data-theme])')).toEqual(palette(":root[data-theme='dark']"));
  });
});
