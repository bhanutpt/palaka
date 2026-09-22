import { describe, expect, it } from 'vitest';
import {
  correct,
  currentIndex,
  emptyRing,
  pendingFinal,
  rawWords,
  setCurrent,
  shift,
  startWord,
  touch,
  trim,
  wordEnd,
  type Ring,
} from '../../src/trvk/ring';

/** Types one whole word into the ring: start it, then set what it renders to. */
function typeWord(ring: Ring, from: number, raw: string, hk: string, rendered: string): Ring {
  return setCurrent(startWord(ring, from), raw, hk, rendered);
}

describe('the recent word ring', () => {
  it('starts empty, with no current word', () => {
    const ring = emptyRing();
    expect(ring.words).toEqual([]);
    expect(currentIndex(ring)).toBe(-1);
    expect(rawWords(ring)).toEqual([]);
  });

  it('keeps the raw roman, the Palaka-HK and where the Telugu sits', () => {
    const ring = typeWord(emptyRing(), 0, 'nenu', 'nEnu', 'నేను');
    const word = ring.words[0];
    expect(word).toMatchObject({ raw: 'nenu', hk: 'nEnu', rendered: 'నేను', from: 0, pass: 'naive', locked: false });
    expect(wordEnd(word)).toBe(4);
    expect(rawWords(ring)).toEqual(['nenu']);
  });

  it('bumps the stamp whenever the raw roman changes, and not otherwise', () => {
    let ring = typeWord(emptyRing(), 0, 'nen', 'nen', 'నెన్');
    const first = ring.words[0].stamp;
    ring = setCurrent(ring, 'nenu', 'nenu', 'నెను');
    expect(ring.words[0].stamp).not.toBe(first);
    const second = ring.words[0].stamp;
    ring = setCurrent(ring, 'nenu', 'nenu', 'నెను');
    expect(ring.words[0].stamp).toBe(second);
  });
});

describe('a correction coming back from the model', () => {
  const twoWords = () => {
    let ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    ring = typeWord(ring, 5, 'eeroju', 'Iroju', 'ఇరొజు');
    return ring;
  };

  it('replaces the word and reports the document change to make', () => {
    const ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    const step = correct(ring, 0, ring.words[0].stamp, 'nEnu', 'నేను', 'live');
    expect(step).not.toBeNull();
    expect(step!.change).toEqual({ from: 0, to: 4, insert: 'నేను' });
    expect(step!.ring.words[0]).toMatchObject({ hk: 'nEnu', rendered: 'నేను', pass: 'live', locked: false });
  });

  it('moves the words after it when the rendering changes length', () => {
    const ring = twoWords();
    const step = correct(ring, 0, ring.words[0].stamp, 'nEnu', 'నేనుు', 'live');
    expect(step!.ring.words[1].from).toBe(6);
  });

  it('locks the word after its one pass with right context', () => {
    const ring = twoWords();
    const step = correct(ring, 0, ring.words[0].stamp, 'nEnu', 'నేను', 'final');
    expect(step!.ring.words[0]).toMatchObject({ pass: 'final', locked: true });
  });

  it('is dropped when the raw roman changed while the request was in flight', () => {
    let ring = typeWord(emptyRing(), 0, 'nen', 'nen', 'నెన్');
    const stale = ring.words[0].stamp;
    ring = setCurrent(ring, 'nenu', 'nenu', 'నెను');
    expect(correct(ring, 0, stale, 'nen', 'నెన్', 'live')).toBeNull();
  });

  it('is dropped for a word that is locked, or for a word that is not there', () => {
    const ring = twoWords();
    const locked = correct(ring, 0, ring.words[0].stamp, 'nEnu', 'నేను', 'final')!.ring;
    expect(correct(locked, 0, locked.words[0].stamp, 'nenu', 'నెను', 'final')).toBeNull();
    expect(correct(ring, 7, 1, 'x', 'ఎక్స్', 'live')).toBeNull();
  });

  it('makes no change when the rendering is the one already in the document', () => {
    const ring = typeWord(emptyRing(), 0, 'nenu', 'nEnu', 'నేను');
    const step = correct(ring, 0, ring.words[0].stamp, 'nEnu', 'నేను', 'final');
    expect(step!.change).toBeNull();
    expect(step!.ring.words[0].locked).toBe(true);
  });
});

describe('which words are waiting for their pass with right context', () => {
  it('is every unlocked word that already has a successor, never the current one', () => {
    let ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    ring = typeWord(ring, 5, 'eeroju', 'Iroju', 'ఇరొజు');
    expect(pendingFinal(ring)).toEqual([0]);

    ring = correct(ring, 0, ring.words[0].stamp, 'nEnu', 'నేను', 'final')!.ring;
    expect(pendingFinal(ring)).toEqual([]);

    ring = typeWord(ring, 12, 'intiki', 'intiki', 'ఇంతికి');
    expect(pendingFinal(ring)).toEqual([1]);
  });
});

describe('an edit the writer makes by other means', () => {
  it('locks the words it touches so they are never revised again', () => {
    let ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    ring = typeWord(ring, 5, 'eeroju', 'Iroju', 'ఇరొజు');
    const after = touch(ring, 1, 2);
    expect(after.words[0].locked).toBe(true);
    expect(after.words[1].locked).toBe(false);
  });

  it('locks a word an edit only meets at its edge', () => {
    const ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    expect(touch(ring, 4, 4).words[0].locked).toBe(true);
  });

  it('moves the words that sit after it', () => {
    let ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    ring = typeWord(ring, 5, 'eeroju', 'Iroju', 'ఇరొజు');
    const after = shift(ring, 4, 3);
    expect(after.words[0].from).toBe(0);
    expect(after.words[1].from).toBe(8);
  });
});

describe('keeping the ring short', () => {
  it('keeps the last words and forgets the older ones', () => {
    let ring = emptyRing();
    for (let i = 0; i < 6; i++) ring = typeWord(ring, i * 5, `w${i}`, `w${i}`, 'ఐ');
    const short = trim(ring, 3);
    expect(rawWords(short)).toEqual(['w3', 'w4', 'w5']);
    expect(currentIndex(short)).toBe(2);
  });

  it('leaves a ring that is already short alone', () => {
    const ring = typeWord(emptyRing(), 0, 'nenu', 'nenu', 'నెను');
    expect(trim(ring, 3)).toBe(ring);
  });
});
