// Messages between the page and the geometry worker.

import type { ParamSpec } from '../../src/params.js';

export type Params = Record<string, number>;

/** What the page needs to draw a part's form: its defaults and what may change. */
export interface PartData {
  defaults: Params;
  schema: Record<string, ParamSpec>;
}

/** Build a part, returning its STL; or its STEP, from the same parameters. */
export interface BuildRequest {
  type: 'stl' | 'step';
  id: number;
  part: string;
  params: Params;
}

export type WorkerMessage =
  /** Sent first, before the kernel loads, so the page can draw its forms. */
  | { type: 'catalogue'; parts: Record<string, PartData> }
  /** Kernel download progress, in bytes of the uncompressed file. */
  | { type: 'loading'; loaded: number; total: number }
  | { type: 'ready'; ms: number }
  /** The kernel can't load or run here. */
  | { type: 'unavailable'; message: string }
  | {
      type: 'built';
      id: number;
      format: 'stl' | 'step';
      file: ArrayBuffer;
      ms: number;
      /** Set when the part doesn't match its declared intent. */
      warning?: string;
    }
  | {
      type: 'failed';
      id: number;
      message: string;
      /** A parameter combination the part refuses, rather than a kernel failure. */
      design: boolean;
    };
