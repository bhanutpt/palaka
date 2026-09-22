/** The messages between the page and the TRVK worker. Every reply carries its request id. */

export interface LoadRequest {
  type: 'load';
  id: number;
  /** URL of the int8 model. */
  model: string;
  /** URL of the vocabulary. */
  vocab: string;
  /** Folder holding the ONNX Runtime files; nothing is ever fetched from a CDN. */
  wasmPaths: string;
  /** URL of the wasm binary, fetched by the worker itself so the download can be reported. */
  wasmBinary: string;
}

export interface CorrectRequest {
  type: 'correct';
  id: number;
  /** Window texts, the word to correct between the markers. One per request: see below. */
  texts: string[];
}

export type ToWorker = LoadRequest | CorrectRequest;

export interface ReadyReply {
  type: 'ready';
  id: number;
  ms: number;
  modelBytes: number;
  nLabels: number;
  maxLen: number;
  ortVersion: string;
  threads: number;
}

export interface ProgressReply {
  type: 'progress';
  id: number;
  loaded: number;
  total: number;
}

export interface ResultReply {
  type: 'result';
  id: number;
  /** Palaka-HK of the marked word, one per window text. */
  targets: string[];
  ms: number;
}

export interface ErrorReply {
  type: 'error';
  id: number;
  message: string;
}

export type FromWorker = ReadyReply | ProgressReply | ResultReply | ErrorReply;
