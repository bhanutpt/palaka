import { describe, expect, it } from 'vitest';
import { findAll, interpretQuery, replacementFor } from '../../src/editor/findModel';
import { inspectLine } from '../../src/editor/inspector';

const cp = (...codes: number[]) => String.fromCharCode(...codes);
const ZWNJ = cp(0x200c);
const ZWJ = cp(0x200d);
const ZWSP = cp(0x200b);
const NBSP = cp(0x00a0);
const VIRAMA = cp(0x0c4d);
const KANNADA_KA = cp(0x0c95);

describe('inspectLine', () => {
  const kinds = (text: string) => inspectLine(text).map((f) => `${f.kind}@${f.from}`);

  it('finds nothing in clean text', () => {
    expect(inspectLine('నేను తెలుగు రాస్తున్నాను. It is 2026!')).toEqual([]);
    expect(inspectLine('కృష్ణ జ్ఞానం స్త్రీ దుఃఖం అఁ')).toEqual([]);
  });

  it('labels invisible characters', () => {
    const findings = inspectLine(`సాఫ్ట్${ZWNJ}వేర్ క్${ZWJ}ష a${ZWSP}b${NBSP}c`);
    expect(findings.map((f) => f.label)).toEqual(['ZWNJ', 'ZWJ', 'ZWSP', 'NBSP']);
    expect(findings.every((f) => f.kind === 'invisible' && f.to === f.from + 1)).toBe(true);
    expect(findings[0]).toMatchObject({ from: 6, message: 'U+200C zero-width non-joiner' });
  });

  it('marks a pollu or a vowel sign with nothing to stand on', () => {
    expect(kinds(`${VIRAMA}క`)).toEqual(['stray@0']);
    expect(kinds(`క${VIRAMA}${VIRAMA}`)).toEqual(['stray@2']);
    expect(kinds('అా')).toEqual(['stray@1']);
    expect(kinds('కాి')).toEqual(['stray@2']);
    expect(kinds(' ం')).toEqual(['stray@1']);
    expect(inspectLine('కాి')[0].message).toMatch(/vowel sign/);
  });

  it('marks letters of another script inside a Telugu word', () => {
    const findings = inspectLine(`తెలు${KANNADA_KA} పలoక`);
    expect(findings.map((f) => [f.kind, f.from, f.label])).toEqual([
      ['foreign', 4, 'Kannada'],
      ['foreign', 8, 'Latin'],
    ]);
    expect(findings[0].message).toBe('U+0C95 Kannada letter inside a Telugu word');
  });

  it('accepts other scripts in their own words', () => {
    expect(inspectLine('తెలుగు English ಕನ್ನಡ हिन्दी')).toEqual([]);
  });
});

describe('interpretQuery', () => {
  it('takes Telugu as it is', () => {
    expect(interpretQuery('తెలు', true)).toEqual({ needle: 'తెలు', open: false, exact: false });
  });

  it('converts roman when asked to, leaving a final consonant open', () => {
    expect(interpretQuery('telu', true)).toEqual({ needle: 'తెలు', open: false, exact: true });
    expect(interpretQuery('tel', true)).toEqual({ needle: 'తెల', open: true, exact: false });
    expect(interpretQuery('k', true)).toEqual({ needle: 'క', open: true, exact: false });
    expect(interpretQuery('bas^', true)).toEqual({ needle: `బస్${ZWNJ}`, open: false, exact: true });
    expect(interpretQuery('`PDF`', true)).toEqual({ needle: 'PDF', open: false, exact: true });
  });

  it('takes roman literally when asked to', () => {
    expect(interpretQuery('tel', false)).toEqual({ needle: 'tel', open: false, exact: false });
  });

  it('is empty for an empty query', () => {
    expect(interpretQuery('', true).needle).toBe('');
  });
});

describe('findAll and replacementFor', () => {
  it('finds every match, without overlaps', () => {
    expect(findAll('కాకి కాకా', interpretQuery('kA', true))).toEqual([0, 5, 7]);
    expect(findAll('aaa', interpretQuery('aa', false))).toEqual([0]);
    expect(findAll('కాకి', interpretQuery('', true))).toEqual([]);
  });

  it('a roman syllable matches that syllable only; an open consonant matches all its forms', () => {
    expect(findAll('కకాక్', interpretQuery('ka', true))).toEqual([0]);
    expect(findAll('కకాక్', interpretQuery('k', true))).toEqual([0, 1, 3]);
    expect(findAll('కకాక్', interpretQuery('క', true))).toEqual([0, 1, 3]);
    expect(findAll('కాం కా', interpretQuery('kA', true))).toEqual([0, 4]);
  });

  it('replaces like with like: an open consonant by an open consonant', () => {
    const query = interpretQuery('k', true);
    expect(replacementFor(query, 'g', true)).toBe('గ');
    expect(replacementFor(query, 'ga', true)).toBe('గ');
    expect(replacementFor(interpretQuery('bas', true), 'kAr', true)).toBe('కార');
    expect(replacementFor(interpretQuery('ka', true), 'g', true)).toBe('గ్');
    expect(replacementFor(interpretQuery('ka', true), 'గీ', true)).toBe('గీ');
    expect(replacementFor(interpretQuery('ka', false), 'g', false)).toBe('g');
  });
});
