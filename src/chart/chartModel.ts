import { compileScheme, toRoman, type GroupId, type Scheme, type SchemeData, type SchemeEntry } from '../engine';

/** Pure model of the character chart, generated from the mapping file. No DOM. */

export interface Tile {
  /** Unique in the chart: the key, or `sign:` plus the key for a vowel-sign tile. */
  id: string;
  key: string;
  /** What the tile shows. */
  display: string;
  /** What a click inserts: exactly what the tile shows. Empty for the keys that output nothing. */
  insert: string;
  /** Spoken label for screen readers. */
  label: string;
  note: string;
  isSign: boolean;
  hasGuninta: boolean;
  disabled: boolean;
}

export interface ChartSection {
  id: string;
  title: string;
  titleTelugu: string;
  /** A fixed number of tiles per row (the varga grid), or 0 to wrap freely. */
  columns: number;
  rows: Tile[][];
}

export interface GunintaCell {
  text: string;
  roman: string;
}

const DOTTED_CIRCLE = '◌';
const CONTROL_NAMES = { zwnj: 'ZWNJ', break: 'split', close: 'close' } as const;
const compiled = new WeakMap<SchemeData, Scheme>();
function schemeOf(data: SchemeData): Scheme {
  let scheme = compiled.get(data);
  if (!scheme) compiled.set(data, (scheme = compileScheme(data)));
  return scheme;
}

const VARGAS: GroupId[] = ['velar', 'palatal', 'retroflex', 'dental', 'labial'];

function primaryTile(entry: SchemeEntry): Tile {
  const consonantal = entry.type === 'consonant' || entry.type === 'conjunct';
  const display = entry.action ? CONTROL_NAMES[entry.action] : entry.letter;
  return {
    id: entry.key,
    key: entry.key,
    display,
    insert: entry.letter,
    label: `${display}, key ${entry.key}`,
    note: entry.note ?? '',
    isSign: false,
    hasGuninta: consonantal,
    disabled: entry.letter === '',
  };
}

function signTile(entry: SchemeEntry): Tile {
  const sign = entry.sign ?? '';
  return {
    id: `sign:${entry.key}`,
    key: entry.key,
    display: DOTTED_CIRCLE + sign,
    insert: sign,
    label: `vowel sign ${sign}, key ${entry.key}`,
    note: entry.note ?? '',
    isSign: true,
    hasGuninta: false,
    disabled: false,
  };
}

/** Sections in the traditional order: vowels, vowel signs, the five vargas, other consonants, signs, rare letters. */
export function buildChart(data: SchemeData): ChartSection[] {
  const group = (id: GroupId) =>
    data.entries.filter((e) => e.group === id).sort((a, b) => a.order - b.order);
  const tiles = (...ids: GroupId[]) => ids.flatMap(group).map(primaryTile);

  return [
    { id: 'vowels', title: 'vowels', titleTelugu: 'అచ్చులు', columns: 0, rows: [tiles('vowels')] },
    {
      id: 'vowel-signs',
      title: 'vowel signs',
      titleTelugu: 'గుణింతపు గుర్తులు',
      columns: 0,
      rows: [group('vowels').filter((e) => e.sign).map(signTile)],
    },
    { id: 'vargas', title: 'consonants', titleTelugu: 'హల్లులు', columns: 5, rows: VARGAS.map((id) => tiles(id)) },
    { id: 'consonants', title: 'more consonants', titleTelugu: '', columns: 0, rows: [tiles('other', 'conjuncts')] },
    { id: 'signs', title: 'signs and controls', titleTelugu: '', columns: 0, rows: [tiles('signs'), tiles('controls')] },
    { id: 'rare', title: 'rare letters', titleTelugu: '', columns: 0, rows: [tiles('rare')] },
    { id: 'digits', title: 'digits (with the Telugu digits setting)', titleTelugu: '', columns: 0, rows: [tiles('digits')] },
  ];
}

/** The guninta row of a consonant: pollu, every vowel form, then the signs, each with its roman spelling. */
export function gunintaOf(tile: Tile, data: SchemeData): GunintaCell[] {
  if (!tile.hasGuninta) return [];
  const vowels = data.entries.filter((e) => e.type === 'vowel').sort((a, b) => a.order - b.order);
  const signs = data.entries.filter((e) => e.type === 'sign').sort((a, b) => a.order - b.order);
  const forms = [
    tile.insert + data.virama,
    ...vowels.map((v) => tile.insert + (v.sign ?? '')),
    ...signs.map((s) => tile.insert + s.letter),
  ];
  // toRoman supplies the canonical spelling, break keys included (లృ is l_R, not lR).
  const scheme = schemeOf(data);
  return forms.map((text) => ({ text, roman: toRoman(text, {}, scheme) }));
}

/** Search by roman key (case ignored), by Telugu letter or sign, or by a word of the note. */
export function matchesQuery(tile: Tile, query: string): boolean {
  const q = query.trim();
  if (q === '') return true;
  // eslint-disable-next-line no-control-regex
  if (/[^\x00-\x7F]/.test(q)) return tile.insert !== '' && q.includes(tile.insert);
  const lower = q.toLowerCase();
  if (tile.key.toLowerCase().includes(lower)) return true;
  return lower.length >= 3 && tile.note.toLowerCase().includes(lower);
}

/** Tile ids for the code points of a piece of Telugu text, in order; unmapped characters are skipped. */
export function tileIdsForText(text: string, data: SchemeData): string[] {
  const scheme = schemeOf(data);
  const ids: string[] = [];
  for (const ch of text) {
    const sign = scheme.vowelBySign.get(ch);
    const entry =
      scheme.consonantByLetter.get(ch) ?? scheme.vowelByLetter.get(ch) ?? scheme.otherByLetter.get(ch) ?? scheme.digitByLetter.get(ch);
    if (sign) ids.push(`sign:${sign.key}`);
    else if (entry) ids.push(entry.key);
  }
  return ids;
}
