/** Shape of scheme/palaka-hk.json, the single source of truth. */

export type EntryType =
  | 'vowel' // independent letter plus dependent vowel sign
  | 'consonant'
  | 'conjunct' // chart-only convenience entry; tokenises as its ordinary parts
  | 'sign' // anusvara, visarga, arasunna
  | 'symbol' // avagraha, danda
  | 'letter' // standalone letter with no inherent vowel (nakaara pollu)
  | 'control' // ^ _ __
  | 'digit'; // active only with the teluguDigits option

export type ControlAction = 'zwnj' | 'break' | 'close';

export const GROUP_ORDER = [
  'vowels',
  'velar',
  'palatal',
  'retroflex',
  'dental',
  'labial',
  'other',
  'conjuncts',
  'signs',
  'controls',
  'rare',
  'digits',
] as const;

export type GroupId = (typeof GROUP_ORDER)[number];

export interface SchemeEntry {
  key: string;
  letter: string;
  /** Dependent vowel sign; vowels only. Empty for the inherent vowel `a`. */
  sign?: string;
  type: EntryType;
  /** Controls only. */
  action?: ControlAction;
  group: GroupId;
  order: number;
  note?: string;
}

export interface SchemeData {
  name: string;
  version: string;
  virama: string;
  entries: SchemeEntry[];
}

export interface ConvertOptions {
  /** Convert 0–9 to ౦–౯ (and back). Default false: digits pass through. */
  teluguDigits?: boolean;
}
