import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** One window the Python export recorded: its text, its character ids and what it decoded to. */
export interface ParityWindow {
  text: string;
  gold: string;
  loose: string;
  source: string;
  char_ids: number[];
  label_ids: number[];
  margins: number[];
  target: string;
  label_ids_fp32?: number[];
}

export interface ParityFixture {
  bundle: { name: string; int8: string; int8_sha256: string; vocab_sha256: string; max_len: number; n_labels: number };
  provenance: Record<string, string>;
  python: { runtime: string; word_acc_on_fixture: number; fp32_recorded: boolean };
  windows: ParityWindow[];
  naive: { loose: string; hk: string }[];
  cuts: { words: string[]; k: number; text: string; n_left: number; n_right: number }[];
  demo: string[];
}

const read = (name: string) =>
  readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

/**
 * The fixture recorded by `scripts/build_web_fixtures.py` in the TRVK repo: 700 windows with
 * the character ids, label ids and decoded Palaka-HK that Python's onnxruntime produced, plus
 * the rule-table tokens and window cuts. Regenerate it there when the model or a port changes.
 */
export const parity = JSON.parse(read('parity.json')) as ParityFixture;

/** The shipped vocabulary, the same file that `public/trvk/vocab.json` serves. */
export const vocabData = JSON.parse(read('vocab.json')) as {
  chars: string[];
  labels: string[];
  max_len: number;
};
