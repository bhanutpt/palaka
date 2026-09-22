/**
 * The recent word ring: for the last few words typed in TRVK mode, the loose roman as it was
 * typed, the Palaka-HK standing for it, and where its Telugu sits in the document.
 *
 * It lives in editor state, never in the document, and it is what lets a word be corrected
 * again when its successor appears. Pure bookkeeping: it computes the document change to
 * make but dispatches nothing.
 *
 * The rules it enforces, from the integration plan §3.2:
 *  - a word is corrected while it is being typed, with no right context;
 *  - once it has a successor it gets exactly one more pass, with right context, and locks;
 *  - a reply for a raw spelling that has since changed is dropped;
 *  - a word the writer edits by any other means locks and is never revised again.
 */

/** Which pass produced the Palaka-HK a word currently shows. */
export type Pass = 'naive' | 'live' | 'final';

export interface RingWord {
  /** The loose roman as the writer typed it. */
  raw: string;
  /** The Palaka-HK now standing for it. */
  hk: string;
  /** The Telugu that Palaka-HK rendered to, as it stands in the document. */
  rendered: string;
  /** Where that Telugu starts in the document. */
  from: number;
  pass: Pass;
  /** True once the word may never be revised again. */
  locked: boolean;
  /** Bumped whenever `raw` changes, so a reply for an older spelling can be dropped. */
  stamp: number;
}

export interface Ring {
  words: readonly RingWord[];
  /** Source of the stamps; monotonic for the life of the ring. */
  stamp: number;
}

/** The document change a correction asks for. */
export interface DocChange {
  from: number;
  to: number;
  insert: string;
}

export interface CorrectionStep {
  ring: Ring;
  /** Null when the model's answer is the text already on screen. */
  change: DocChange | null;
}

export const emptyRing = (): Ring => ({ words: [], stamp: 0 });

export const wordEnd = (word: RingWord): number => word.from + word.rendered.length;

export const currentIndex = (ring: Ring): number => ring.words.length - 1;

/** The loose roman of every word in the ring: the context the model window is cut from. */
export const rawWords = (ring: Ring): string[] => ring.words.map((word) => word.raw);

/** Begins a new word at `from`; it becomes the current one. */
export function startWord(ring: Ring, from: number): Ring {
  const stamp = ring.stamp + 1;
  const word: RingWord = { raw: '', hk: '', rendered: '', from, pass: 'naive', locked: false, stamp };
  return { words: [...ring.words, word], stamp };
}

/** Replaces what the current word is: its raw roman, its Palaka-HK and its rendering. */
export function setCurrent(ring: Ring, raw: string, hk: string, rendered: string): Ring {
  const index = currentIndex(ring);
  if (index < 0) return ring;
  const word = ring.words[index];
  const changed = word.raw !== raw;
  const stamp = changed ? ring.stamp + 1 : ring.stamp;
  const words = ring.words.slice();
  words[index] = { ...word, raw, hk, rendered, pass: 'naive', stamp: changed ? stamp : word.stamp };
  return { words, stamp };
}

/**
 * Applies a correction the model sent back. Null when it is stale: the word is gone, it is
 * locked, or its raw spelling changed while the request was in flight.
 */
export function correct(
  ring: Ring,
  index: number,
  stamp: number,
  hk: string,
  rendered: string,
  pass: Pass,
): CorrectionStep | null {
  const word = ring.words[index];
  if (!word || word.locked || word.stamp !== stamp) return null;

  const from = word.from;
  const to = wordEnd(word);
  const delta = rendered.length - word.rendered.length;
  const words = ring.words.slice();
  words[index] = { ...word, hk, rendered, pass, locked: pass === 'final' };
  for (let i = index + 1; i < words.length; i++) words[i] = { ...words[i], from: words[i].from + delta };

  const change = rendered === word.rendered ? null : { from, to, insert: rendered };
  return { ring: { words, stamp: ring.stamp }, change };
}

/**
 * Words waiting for their one pass with right context: everything before the current word
 * that is not locked and has not had that pass yet.
 */
export function pendingFinal(ring: Ring): number[] {
  const out: number[] = [];
  for (let i = 0; i < ring.words.length - 1; i++) {
    const word = ring.words[i];
    if (!word.locked && word.pass !== 'final') out.push(i);
  }
  return out;
}

/** An edit made by any other means: the words it meets lock and are never revised again. */
export function touch(ring: Ring, from: number, to: number): Ring {
  let hit = false;
  const words = ring.words.map((word) => {
    if (word.locked || from > wordEnd(word) || to < word.from) return word;
    hit = true;
    return { ...word, locked: true };
  });
  return hit ? { words, stamp: ring.stamp } : ring;
}

/** Moves every word that sits after `at` by `delta` characters. */
export function shift(ring: Ring, at: number, delta: number): Ring {
  if (delta === 0) return ring;
  const words = ring.words.map((word) => (word.from >= at ? { ...word, from: word.from + delta } : word));
  return { words, stamp: ring.stamp };
}

/** Keeps the last `keep` words and forgets the older ones. */
export function trim(ring: Ring, keep: number): Ring {
  if (ring.words.length <= keep) return ring;
  return { words: ring.words.slice(ring.words.length - keep), stamp: ring.stamp };
}
