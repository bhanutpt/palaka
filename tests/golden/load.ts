import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface GoldenPair {
  roman: string;
  telugu: string;
  line: number;
}

/** Marks an expected output of nothing; a trailing tab would not survive most editors. */
const EMPTY = '(empty)';

const unescape = (s: string) =>
  s.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

/** Reads a golden file: roman, tab, expected Telugu. # comments and blank lines are skipped. */
export function loadGolden(name: string): GoldenPair[] {
  const path = fileURLToPath(new URL(name, import.meta.url));
  const pairs: GoldenPair[] = [];
  readFileSync(path, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((text, index) => {
      if (text.trim() === '' || text.startsWith('#')) return;
      const tab = text.indexOf('\t');
      if (tab < 0) throw new Error(`${name}:${index + 1}: no tab separator`);
      pairs.push({
        roman: unescape(text.slice(0, tab)),
        telugu: text.slice(tab + 1) === EMPTY ? '' : unescape(text.slice(tab + 1)),
        line: index + 1,
      });
    });
  return pairs;
}
