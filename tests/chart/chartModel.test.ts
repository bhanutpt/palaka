import { describe, expect, it } from 'vitest';
import { buildChart, gunintaOf, matchesQuery, tileIdsForText, type Tile } from '../../src/chart/chartModel';
import { schemeData, toTelugu } from '../../src/engine';

const chart = buildChart(schemeData);
const tiles = chart.flatMap((section) => section.rows.flat());
const primary = tiles.filter((tile) => !tile.isSign);
const byId = (id: string) => tiles.find((tile) => tile.id === id) as Tile;

describe('buildChart', () => {
  it('shows every key of the mapping exactly once', () => {
    expect(primary.map((t) => t.key).sort()).toEqual(schemeData.entries.map((e) => e.key).sort());
  });

  it('has unique tile ids', () => {
    expect(new Set(tiles.map((t) => t.id)).size).toBe(tiles.length);
  });

  it('follows the traditional order', () => {
    expect(chart.map((s) => s.id)).toEqual(['vowels', 'vowel-signs', 'vargas', 'consonants', 'signs', 'rare', 'digits']);
    expect(chart[0].rows.flat().map((t) => t.key).join(' ')).toBe('a A i I u U R RR lR lRR e E ai o O au');
    expect(chart[3].rows.flat().map((t) => t.key).join(' ')).toBe('y r l v z S s h L rx kS jJ');
  });

  it('lays the five vargas out as a 5 by 5 grid', () => {
    const vargas = chart[2].rows;
    expect(vargas.map((row) => row.map((t) => t.key).join(' '))).toEqual([
      'k kh g gh G',
      'c ch j jh J',
      'T Th D Dh N',
      't th d dh n',
      'p ph b bh m',
    ]);
  });

  it('derives one sign tile from every vowel except the inherent one', () => {
    const signs = chart[1].rows.flat();
    expect(signs.map((t) => t.key).join(' ')).toBe('A i I u U R RR lR lRR e E ai o O au');
    expect(byId('sign:A')).toMatchObject({ insert: 'ా', display: '◌ా', isSign: true });
  });

  it('inserts what the tile shows', () => {
    expect(byId('k')).toMatchObject({ display: 'క', insert: 'క', hasGuninta: true });
    expect(byId('A')).toMatchObject({ display: 'ఆ', insert: 'ఆ', hasGuninta: false });
    expect(byId('kS')).toMatchObject({ insert: 'క్ష', hasGuninta: true });
    expect(byId('^').insert).toBe(String.fromCharCode(0x200c));
    expect(byId('_')).toMatchObject({ insert: '', disabled: true });
    expect(byId('nx')).toMatchObject({ insert: 'ౝ', hasGuninta: false });
  });

  it('gives every tile a spoken label', () => {
    for (const tile of tiles) expect(tile.label, tile.id).toMatch(/\S/);
    expect(byId('k').label).toBe('క, key k');
    expect(byId('sign:A').label).toBe('vowel sign ా, key A');
  });
});

describe('gunintaOf', () => {
  it('lists the pollu, every vowel form and the signs with their roman spelling', () => {
    const cells = gunintaOf(byId('k'), schemeData);
    expect(cells.slice(0, 5)).toEqual([
      { text: 'క్', roman: 'k' },
      { text: 'క', roman: 'ka' },
      { text: 'కా', roman: 'kA' },
      { text: 'కి', roman: 'ki' },
      { text: 'కీ', roman: 'kI' },
    ]);
    expect(cells.slice(-3).map((c) => c.roman)).toEqual(['kaM', 'kaH', 'kaMx']);
    expect(cells).toHaveLength(20);
  });

  it('spells forms that need the break key correctly', () => {
    const cells = gunintaOf(byId('l'), schemeData);
    expect(cells.find((c) => c.text === 'లృ')?.roman).toBe('l_R');
  });

  it('every cell of every consonant types back to itself', () => {
    for (const tile of primary.filter((t) => t.hasGuninta)) {
      for (const cell of gunintaOf(tile, schemeData)) expect(toTelugu(cell.roman), cell.roman).toBe(cell.text);
    }
  });

  it('is empty for tiles without a guninta', () => {
    expect(gunintaOf(byId('A'), schemeData)).toEqual([]);
  });
});

describe('matchesQuery', () => {
  const matching = (query: string) => tiles.filter((t) => matchesQuery(t, query)).map((t) => t.id);

  it('matches everything when empty', () => {
    expect(matching('  ')).toHaveLength(tiles.length);
  });

  it('matches by roman key, ignoring case', () => {
    expect(matching('kh')).toEqual(['kh']);
    expect(matching('dh')).toEqual(['Dh', 'dh']);
  });

  it('matches by Telugu letter or sign', () => {
    expect(matching('ఖ')).toEqual(['kh']);
    expect(matching('కా')).toEqual(['sign:A', 'k']);
  });

  it('matches by note for longer queries', () => {
    expect(matching('visarga')).toEqual(['H']);
  });
});

describe('tileIdsForText', () => {
  it('names the tiles of each code point in a syllable', () => {
    expect(tileIdsForText('కృ', schemeData)).toEqual(['k', 'sign:R']);
    expect(tileIdsForText('స్త్రీం', schemeData)).toEqual(['s', 't', 'r', 'sign:I', 'M']);
    expect(tileIdsForText('ఆ', schemeData)).toEqual(['A']);
    expect(tileIdsForText('x ', schemeData)).toEqual([]);
  });
});
