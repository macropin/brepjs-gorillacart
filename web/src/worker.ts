// The geometry worker. Loads the OpenCascade kernel, then builds parts on
// request and returns each as an STL or STEP file. Everything here runs off the
// page's main thread: a build can take seconds.

import {
  exportSTEP,
  exportSTL,
  getBounds,
  measureVolume,
  OcctWasmAdapter,
  registerKernel,
  unwrap,
  type ValidSolid,
} from 'brepjs';
import { OcctKernel } from 'occt-wasm';
import kernelUrl from 'occt-wasm/dist/occt-wasm.wasm?url';

import { DesignError } from '../../src/params.js';
import { parts, type Expected } from './parts.js';
import type { BuildRequest, PartData, WorkerMessage } from './protocol.js';

function send(message: WorkerMessage, transfer: Transferable[] = []): void {
  postMessage(message, { transfer });
}

// The forms first, so the page can draw them while the kernel downloads.
send({
  type: 'catalogue',
  parts: Object.fromEntries(
    Object.entries(parts).map(([id, part]): [string, PartData] => [
      id,
      {
        defaults: { ...part.defaults },
        schema: Object.fromEntries(
          Object.entries(part.schema).filter((entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
            Boolean(entry[1]),
          ),
        ),
      },
    ]),
  ),
});

const kernelReady: Promise<boolean> = loadKernel().then(
  (ms) => {
    send({ type: 'ready', ms });
    return true;
  },
  (error: unknown) => {
    send({
      type: 'unavailable',
      message: `The geometry kernel didn't start in this browser: ${describe(error)}`,
    });
    return false;
  },
);

async function loadKernel(): Promise<number> {
  const started = performance.now();
  const wasm = await fetchKernel();
  const kernel = await OcctKernel.init({ wasm });
  registerKernel('occt-wasm', OcctWasmAdapter.fromKernel(kernel));
  return performance.now() - started;
}

// ---------------------------------------------------------------------------
// The kernel download
// ---------------------------------------------------------------------------

/** Cache Storage holds the kernel across visits; its URL carries a content hash. */
const CACHE = 'occt-wasm';

async function openCache(): Promise<Cache | undefined> {
  try {
    return await caches.open(CACHE);
  } catch {
    return undefined; // no Cache Storage here: an insecure origin, or storage blocked
  }
}

async function fetchKernel(): Promise<ArrayBuffer> {
  const url = new URL(kernelUrl, location.href).href;
  const cache = await openCache();
  try {
    const hit = await cache?.match(url);
    if (hit) return await hit.arrayBuffer();
  } catch {
    // fall through to the network
  }

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }

  // Read it in chunks to report progress. Content-Length counts compressed
  // bytes when it is served compressed, so measure against the file's own size.
  const total = __KERNEL_BYTES__;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let reported = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    if (performance.now() - reported > 100) {
      send({ type: 'loading', loaded, total });
      reported = performance.now();
    }
  }
  send({ type: 'loading', loaded, total });

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  if (cache) {
    try {
      // Drop any earlier kernel, then keep this one.
      for (const key of await cache.keys()) if (key.url !== url) await cache.delete(key);
      await cache.put(
        url,
        new Response(bytes.slice(), { headers: { 'Content-Type': 'application/wasm' } }),
      );
    } catch {
      // Not cached: the next visit downloads it again.
    }
  }
  return bytes.buffer;
}

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

/** The last part built, so asking for its STEP doesn't build it again. */
let last: { key: string; shape: ValidSolid; warning: string | undefined } | undefined;

onmessage = async (event: MessageEvent<BuildRequest>) => {
  const request = event.data;
  if (!(await kernelReady)) {
    send({
      type: 'failed',
      id: request.id,
      design: false,
      message: 'The geometry kernel is not available in this browser.',
    });
    return;
  }
  await handle(request);
};

async function handle(request: BuildRequest): Promise<void> {
  const started = performance.now();
  try {
    const part = parts[request.part];
    if (!part) throw new Error(`no part named ${request.part}`);

    const key = JSON.stringify([request.part, request.params]);
    if (last?.key !== key) {
      const design = part.design({ ...part.defaults, ...request.params });
      const shape = design.model();
      last = { key, shape, warning: check(shape, design.expected) };
    }
    const { shape, warning } = last;

    const blob = unwrap(request.type === 'stl' ? exportSTL(shape, { binary: true }) : exportSTEP(shape));
    const file = await blob.arrayBuffer();
    send(
      {
        type: 'built',
        id: request.id,
        format: request.type,
        file,
        ms: performance.now() - started,
        warning,
      },
      [file],
    );
  } catch (error) {
    const design = error instanceof DesignError;
    send({
      type: 'failed',
      id: request.id,
      design,
      message: design
        ? describe(error)
        : `The geometry kernel couldn't build this combination. Try nudging one of the values. (${describe(error)})`,
    });
  }
}

/**
 * Checks the part against its declared intent, as `brep verify --check` does,
 * and words any mismatch for the page.
 */
function check(shape: ValidSolid, expected: Expected): string | undefined {
  const volume = unwrap(measureVolume(shape));
  const off = Math.abs(volume - expected.volume) / expected.volume;
  if (off > expected.tolerancePct / 100) {
    return `Its volume is ${(off * 100).toFixed(1)}% off what its design predicts. Check it in your slicer before printing.`;
  }
  const bounds = getBounds(shape);
  for (const [name, value] of Object.entries(expected.bounds)) {
    const actual = bounds[name as keyof typeof bounds];
    if (Math.abs(actual - value) > 0.01) {
      return `Its size is off what its design predicts. Check it in your slicer before printing.`;
    }
  }
  return undefined;
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
