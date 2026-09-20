import { compileScheme } from './scheme';
import { toRoman } from './toRoman';
import { convert } from './toTelugu';
import { GROUP_ORDER, type ConvertOptions, type SchemeData, type SchemeEntry } from './types';

const ENTRY_TYPES = ['vowel', 'consonant', 'conjunct', 'sign', 'symbol', 'letter', 'control', 'digit'];
const SEMVER = /^\d+\.\d+\.\d+$/;
const VARIANT_MARK = 'x';

/**
 * Build-time check of the mapping file. Returns a list of problems; empty means valid.
 * Fails on key collisions, a letter with two keys, or any entry that breaks the round trip.
 */
export function validateScheme(data: SchemeData): string[] {
  const errors: string[] = [];

  if (!data.name) errors.push('scheme has no name');
  if (!SEMVER.test(data.version ?? '')) errors.push(`version "${data.version}" is not MAJOR.MINOR.PATCH`);
  if (Array.from(data.virama ?? '').length !== 1) errors.push('virama must be one code point');

  const keys = new Map<string, SchemeEntry>();
  const outputs = new Map<string, SchemeEntry>();
  const orders = new Set<string>();
  const claim = (output: string, entry: SchemeEntry) => {
    const other = outputs.get(output);
    if (other) errors.push(`"${output}" has two canonical keys: "${other.key}" and "${entry.key}"`);
    outputs.set(output, entry);
  };

  for (const entry of data.entries) {
    const label = `entry "${entry.key}"`;

    if (!/^[!-~]+$/.test(entry.key ?? '') || entry.key.includes('`')) {
      errors.push(`${label}: key must be printable ASCII with no space or backtick`);
      continue;
    }
    if (keys.has(entry.key)) errors.push(`key collision: "${entry.key}" is defined twice`);
    keys.set(entry.key, entry);

    if (!ENTRY_TYPES.includes(entry.type)) errors.push(`${label}: unknown type "${entry.type}"`);
    if (!GROUP_ORDER.includes(entry.group)) {
      errors.push(`${label}: group "${entry.group}" is not in the chart`);
    }
    const slot = `${entry.group}/${entry.order}`;
    if (orders.has(slot)) errors.push(`${label}: order ${entry.order} is used twice in group "${entry.group}"`);
    orders.add(slot);

    // x has no sound of its own: it only ever marks a variant of the key before it.
    const x = entry.key.indexOf(VARIANT_MARK);
    if (x !== -1 && (x === 0 || x !== entry.key.length - 1)) {
      errors.push(`${label}: "x" may only be the final character of a key`);
    }

    const isDigitKey = /^[0-9]$/.test(entry.key);
    if (entry.type === 'digit' && !isDigitKey) errors.push(`${label}: digit keys must be 0-9`);
    if (entry.type !== 'digit' && /[0-9]/.test(entry.key)) errors.push(`${label}: only digit entries may use 0-9`);

    if (entry.type === 'vowel' && typeof entry.sign !== 'string') errors.push(`${label}: vowel needs a sign`);
    if (entry.type === 'control' && !entry.action) errors.push(`${label}: control needs an action`);
    if (entry.type !== 'control' && !entry.letter) errors.push(`${label}: letter is empty`);

    if (entry.letter) claim(entry.letter, entry);
    if (entry.type === 'vowel' && entry.sign) claim(entry.sign, entry);
  }

  // Live typing renders every keystroke, so each key must be reachable through keys:
  // lRR through lR through l. A key whose prefix is not a key could never be typed.
  for (const key of keys.keys()) {
    const prefix = key.slice(0, -1);
    if (prefix && !keys.has(prefix)) errors.push(`entry "${key}": its prefix "${prefix}" is not a key`);
  }

  const count = (test: (e: SchemeEntry) => boolean) => data.entries.filter(test).length;
  if (count((e) => e.type === 'vowel' && e.sign === '') !== 1) errors.push('exactly one vowel must be inherent (empty sign)');
  for (const action of ['zwnj', 'break', 'close']) {
    if (count((e) => e.type === 'control' && e.action === action) !== 1) {
      errors.push(`exactly one control must have action "${action}"`);
    }
  }

  // The remaining checks run the engine, which needs a structurally sound map.
  if (errors.length > 0) return errors;

  const scheme = compileScheme(data);
  const digits: ConvertOptions = { teluguDigits: true };
  const roundTrip = (telugu: string, options: ConvertOptions = {}) => {
    const roman = toRoman(telugu, options, scheme);
    const back = convert(roman, options, scheme).text;
    if (back !== telugu) errors.push(`round trip broken: "${telugu}" -> "${roman}" -> "${back}"`);
  };

  const atoms: string[] = [];
  for (const entry of data.entries) {
    const options = entry.type === 'digit' ? digits : {};
    const isConsonantal = entry.type === 'consonant' || entry.type === 'conjunct';
    const expected = isConsonantal ? entry.letter + data.virama : entry.letter;

    const forward = convert(entry.key, options, scheme).text;
    if (forward !== expected) errors.push(`entry "${entry.key}": gives "${forward}", expected "${expected}"`);
    if (expected) {
      const reverse = toRoman(expected, options, scheme);
      if (reverse !== entry.key) errors.push(`entry "${entry.key}": "${expected}" reads back as "${reverse}"`);
    }

    if (entry.letter) atoms.push(entry.letter);
    if (entry.sign) atoms.push(entry.sign);
    if (isConsonantal) atoms.push(expected);
  }

  // Every ordered pair of letters, signs and pollu forms must survive the round trip;
  // this is what proves the break key is inserted wherever two keys would merge.
  for (const a of atoms) {
    for (const b of atoms) {
      roundTrip((a + b).normalize('NFC'));
      roundTrip((a + b).normalize('NFC'), digits);
    }
  }

  return errors;
}
