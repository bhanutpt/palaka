import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { schemeData, toTelugu } from '../../src/engine';
import { backspace, typeChar, type Composition } from '../../src/editor/composer';

/** Types a string one keystroke at a time; returns the finalised text and the live syllable. */
function type(keys: string, options = {}) {
  let text = '';
  let live: Composition | null = null;
  const frames: string[] = [];
  for (const key of keys) {
    const step = typeChar(live, key, options);
    text += step.committed;
    live = step.composition;
    frames.push(text + (live?.rendered ?? ''));
  }
  return { text, live, frames, all: text + (live?.rendered ?? '') };
}

describe('typeChar', () => {
  it('re-renders the syllable on every keystroke', () => {
    expect(type('khA').frames).toEqual(['క్', 'ఖ్', 'ఖా']);
    expect(type('kai').frames).toEqual(['క్', 'క', 'కై']);
    expect(type('klR').frames).toEqual(['క్', 'క్ల్', 'కౢ']);
    expect(type('aMx').frames).toEqual(['అ', 'అం', 'అఁ']);
    expect(type('||').frames).toEqual(['।', '॥']);
  });

  it('keeps only the syllable in progress in the buffer', () => {
    const { text, live } = type('palak');
    expect(text).toBe('పల');
    expect(live).toEqual({ roman: 'k', rendered: 'క్' });
  });

  it('keeps a consonant cluster in one buffer', () => {
    expect(type('strI').live).toEqual({ roman: 'strI', rendered: 'స్త్రీ' });
  });

  it('starts a new syllable after a control key', () => {
    const { text, live } = type('T^v');
    expect(text).toBe('ట్\u200C');
    expect(live?.roman).toBe('v');
    expect(type('k_h').all).toBe('క్హ్');
    expect(type('k__a').all).toBe('క్అ');
  });

  it('ends the buffer on a space, punctuation or an unmapped letter', () => {
    expect(type('ka ').live).toBeNull();
    expect(type('ka,').live).toBeNull();
    expect(type('ka5').live).toBeNull();
    const step = typeChar({ roman: 'ka', rendered: 'క' }, 'f');
    expect(step).toEqual({ committed: 'కf', composition: null, unmapped: ['f'] });
  });

  it('keeps digits in the buffer only when they are keys', () => {
    expect(type('5', { teluguDigits: true }).all).toBe('౫');
    expect(type('5').all).toBe('5');
  });

  it('holds a literal span open until its closing backtick', () => {
    expect(type('`').live).toEqual({ roman: '`', rendered: '' });
    expect(type('`PDF fi').live).toEqual({ roman: '`PDF fi', rendered: 'PDF fi' });
    const closed = type('`PDF`');
    expect(closed.live).toBeNull();
    expect(closed.text).toBe('PDF');
    expect(type('``').text).toBe('`');
    expect(typeChar({ roman: '`w', rendered: 'w' }, 'q').unmapped).toEqual([]);
  });

  it('types the worked examples of the plan', () => {
    const examples = ['palaka', 'telugu', 'dEzaM', 'kRSNa', 'jJAnaM', 'gurraM', 'ceTTu', 'sAphT^vEr'];
    for (const roman of examples) expect(type(roman).all).toBe(toTelugu(roman));
  });

  it('typing keystroke by keystroke always equals converting the whole text', () => {
    const keys = schemeData.entries.filter((e) => e.type !== 'conjunct').map((e) => e.key);
    const input = fc
      .array(fc.oneof({ weight: 8, arbitrary: fc.constantFrom(...keys) }, { weight: 1, arbitrary: fc.constantFrom(' ', '`', 'f', 'x', '.', '`ab`') }), { maxLength: 30 })
      .map((parts) => parts.join(''));
    fc.assert(
      fc.property(input, fc.boolean(), (roman, teluguDigits) => {
        expect(type(roman, { teluguDigits }).all).toBe(toTelugu(roman, { teluguDigits }));
      }),
      { numRuns: 3000 },
    );
  });
});

describe('backspace', () => {
  it('removes one roman keystroke', () => {
    expect(backspace({ roman: 'khA', rendered: 'ఖా' })).toEqual({ roman: 'kh', rendered: 'ఖ్' });
    expect(backspace({ roman: 'kh', rendered: 'ఖ్' })).toEqual({ roman: 'k', rendered: 'క్' });
    expect(backspace({ roman: 'ai', rendered: 'ఐ' })).toEqual({ roman: 'a', rendered: 'అ' });
    expect(backspace({ roman: '`ab', rendered: 'ab' })).toEqual({ roman: '`a', rendered: 'a' });
  });

  it('ends the buffer when nothing is left', () => {
    expect(backspace({ roman: 'k', rendered: 'క్' })).toBeNull();
  });
});
