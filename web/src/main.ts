// The page: pick an accessory and one of its parts, change its dimensions,
// preview it and download it. Every part, at its defaults too, is built in
// ./worker.ts.

import './style.css';

import {
  applies,
  on,
  type ChoiceSpec,
  type DimensionSpec,
  type ParamSpec,
  type ToggleSpec,
} from '../../src/params.js';
import { accessories, docUrl, type AccessoryInfo, type PartInfo } from './accessories.js';
import type { BuildRequest, Params, PartData, WorkerMessage } from './protocol.js';
import { Viewer, type Measured } from './viewer.js';

/** Wait this long after the last change before building. */
const SETTLE_MS = 250;

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`#${id} is missing from index.html`);
  return found as T;
}

const ui = {
  accessoryList: element('accessory-list'),
  title: element('part-title'),
  summary: element('part-summary'),
  doc: element<HTMLAnchorElement>('part-doc'),
  tabs: element('part-tabs'),
  count: element('part-count'),
  form: element<HTMLFormElement>('params'),
  stl: element<HTMLAnchorElement>('download-stl'),
  step: element<HTMLButtonElement>('download-step'),
  reset: element<HTMLButtonElement>('reset'),
  copy: element<HTMLButtonElement>('copy-link'),
  status: element('status'),
  readout: element('readout'),
  resetView: element<HTMLButtonElement>('reset-view'),
  overlay: element('preview-overlay'),
  kernel: element('kernel-status'),
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const first = accessories[0]!;
let accessory: AccessoryInfo = first;
let part: PartInfo = first.parts[0]!;

/** Each part's defaults and schema, once the worker has sent them. */
let catalogue: Record<string, PartData> | undefined;

/** The values changed from their defaults, per accessory. */
const changes = new Map<string, Params>();

type KernelState = { state: 'loading'; loaded: number; total: number } | { state: 'ready' } | { state: 'unavailable'; message: string };
let kernel: KernelState = { state: 'loading', loaded: 0, total: __KERNEL_BYTES__ };

/** What the preview and the STL link show: a part and its changed values. */
interface Shown {
  key: string;
  measured: Measured;
}
let shown: Shown | undefined;

/** The part the camera was last framed on. */
let framedPart: string | undefined;

function changed(): Params {
  return changes.get(accessory.id) ?? {};
}

function data(): PartData | undefined {
  return catalogue?.[part.id];
}

/** Only the changes this part takes: the stack locator takes none of the kit's. */
function partChanges(): Params {
  const d = data();
  const all = changed();
  if (!d) return all;
  // Nor those that don't apply to it as it stands: a hole size, once it has slits.
  const values = { ...d.defaults, ...all };
  return Object.fromEntries(
    Object.entries(all).filter(([name]) => {
      const spec = d.schema[name];
      return spec !== undefined && applies(spec, values);
    }),
  );
}

function stateKey(): string {
  return JSON.stringify([part.id, sorted(partChanges())]);
}

function sorted(params: Params): Params {
  return Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
}

// ---------------------------------------------------------------------------
// The URL: #accessory/part?name=value&...
// ---------------------------------------------------------------------------

function readHash(): void {
  const [path = '', query = ''] = decodeURIComponent(location.hash.slice(1)).split('?');
  const [accessoryId, partId] = path.split('/');
  accessory = accessories.find((a) => a.id === accessoryId) ?? first;
  part = accessory.parts.find((p) => p.id === partId) ?? accessory.parts[0]!;
  const values: Params = {};
  for (const [name, raw] of new URLSearchParams(query)) {
    const value = Number(raw);
    if (raw !== '' && Number.isFinite(value)) values[name] = value;
  }
  changes.set(accessory.id, values);
  if (catalogue) tidyChanges();
}

function writeHash(): void {
  const query = new URLSearchParams(
    Object.entries(sorted(changed())).map(([name, value]) => [name, String(value)]),
  ).toString();
  const path = part === accessory.parts[0] ? accessory.id : `${accessory.id}/${part.id}`;
  history.replaceState(null, '', `#${path}${query ? `?${query}` : ''}`);
}

/**
 * Drops values the accessory doesn't take or that equal their defaults, and
 * clamps the rest into range: a link may have been edited by hand.
 */
function tidyChanges(): void {
  const merged = schemaFor(accessory);
  const values = changed();
  for (const [name, value] of Object.entries(values)) {
    const entry = merged[name];
    if (!entry) {
      delete values[name];
      continue;
    }
    const { spec } = entry;
    let clamped: number;
    if (spec.kind === 'choice') {
      clamped = spec.options.some((o) => same(o.value, value)) ? value : entry.fallback;
    } else {
      clamped = Math.min(spec.max, Math.max(spec.min, value));
      if (spec.kind === 'toggle') clamped = on(clamped) ? 1 : 0;
    }
    if (same(clamped, entry.fallback)) delete values[name];
    else values[name] = clamped;
  }
}

/** Every parameter the accessory's parts take, with its spec and default. */
function schemaFor(info: AccessoryInfo): Record<string, { spec: ParamSpec; fallback: number }> {
  const merged: Record<string, { spec: ParamSpec; fallback: number }> = {};
  for (const p of info.parts) {
    const d = catalogue?.[p.id];
    if (!d) continue;
    for (const [name, spec] of Object.entries(d.schema)) {
      merged[name] ??= { spec, fallback: d.defaults[name] ?? 0 };
    }
  }
  return merged;
}

const same = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ---------------------------------------------------------------------------
// The worker
// ---------------------------------------------------------------------------

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });

let nextId = 1;
/** The preview build the worker is on, and the newest one waiting behind it. */
let previewInFlight: { id: number; key: string } | undefined;
let previewWanted: { key: string; request: BuildRequest } | undefined;
/** STEP builds waiting on the worker, by request id, with the file name to save as. */
const stepRequests = new Map<number, string>();

worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;
  switch (message.type) {
    case 'catalogue':
      catalogue = message.parts;
      tidyChanges();
      renderPart();
      refresh();
      break;
    case 'loading':
      kernel = { state: 'loading', loaded: message.loaded, total: message.total };
      renderKernel();
      break;
    case 'ready':
      kernel = { state: 'ready' };
      renderKernel();
      pump();
      break;
    case 'unavailable':
      kernel = { state: 'unavailable', message: message.message };
      renderKernel();
      refresh();
      break;
    case 'built':
      if (message.format === 'step') {
        const name = stepRequests.get(message.id);
        stepRequests.delete(message.id);
        if (name) save(new Blob([message.file], { type: 'model/step' }), name);
        ui.step.disabled = false;
        break;
      }
      if (previewInFlight?.id === message.id) {
        const { key } = previewInFlight;
        previewInFlight = undefined;
        if (key === stateKey()) showBuilt(message.file, key, message.ms, message.warning);
      }
      pump();
      break;
    case 'failed':
      if (stepRequests.delete(message.id)) {
        ui.step.disabled = false;
        setStatus('error', message.message);
        break;
      }
      if (previewInFlight?.id === message.id) {
        const { key } = previewInFlight;
        previewInFlight = undefined;
        if (key === stateKey()) showFailure(message.message);
      }
      pump();
      break;
  }
};

worker.onerror = (event) => {
  kernel = { state: 'unavailable', message: event.message || 'the geometry worker failed to start' };
  renderKernel();
  refresh();
};

/** Sends the newest wanted preview build, once the worker is free and the kernel ready. */
function pump(): void {
  if (previewInFlight || !previewWanted || kernel.state !== 'ready') return;
  const { key, request } = previewWanted;
  previewWanted = undefined;
  if (key !== stateKey()) return; // superseded while waiting
  previewInFlight = { id: request.id, key };
  worker.postMessage(request);
  setStatus('busy', 'Building…');
}

function requestPreview(): void {
  const request: BuildRequest = { type: 'stl', id: nextId++, part: part.id, params: partChanges() };
  previewWanted = { key: stateKey(), request };
  if (kernel.state === 'unavailable') {
    showFailure(`${kernel.message} You can still build the files from source, as the README describes.`);
    return;
  }
  if (kernel.state === 'loading') setStatus('busy', 'Waiting for the geometry kernel to load…');
  pump();
}

// ---------------------------------------------------------------------------
// Showing a part
// ---------------------------------------------------------------------------

const viewer = new Viewer(element('viewer'));
let objectUrl: string | undefined;
let refreshTimer: number | undefined;

/** Shows the part as it now stands, after a short settle for edits in progress. */
function refresh(settle = false): void {
  clearTimeout(refreshTimer);
  if (settle) {
    refreshTimer = window.setTimeout(() => refresh(false), SETTLE_MS);
    return;
  }
  writeHash();
  const key = stateKey();
  if (shown?.key === key) return;
  setDownloads(undefined);
  // Until the worker sends the catalogue, the part's dimensions aren't known.
  if (catalogue) requestPreview();
  else setStatus('busy', 'Starting the generator…');
}

function showBuilt(file: ArrayBuffer, key: string, ms: number, warning: string | undefined): void {
  present(key, file);
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(new Blob([file], { type: 'model/stl' }));
  setDownloads(objectUrl);
  if (warning) setStatus('warning', warning);
  else setStatus('done', `Built in ${(ms / 1000).toFixed(1)} s.`);
}

function showFailure(message: string): void {
  shown = undefined;
  viewer.clear();
  ui.readout.textContent = '';
  setDownloads(undefined);
  setStatus('error', message);
}

function present(key: string, file: ArrayBuffer): void {
  const frame = framedPart !== part.id;
  framedPart = part.id;
  const measured = viewer.show(file, frame);
  shown = { key, measured };
  const [x, y, z] = measured.size.map((v) => v.toFixed(1));
  ui.readout.textContent = `${x} × ${y} × ${z} mm · ${(measured.volume / 1000).toFixed(1)} cm³`;
}

/** Points the STL link at a file, or disables it. */
function setDownloads(href: string | undefined): void {
  if (href) {
    ui.stl.href = href;
    ui.stl.download = `${fileStem()}.stl`;
    ui.stl.removeAttribute('aria-disabled');
  } else {
    ui.stl.removeAttribute('href');
    ui.stl.setAttribute('aria-disabled', 'true');
  }
  ui.step.disabled = !href;
}

/** The part's name, with its changed values: pole-holder-poleDiameter32. */
function fileStem(): string {
  const suffix = Object.entries(sorted(partChanges()))
    .map(([name, value]) => `${name}${value}`)
    .join('-');
  return suffix ? `${part.id}-${suffix}` : part.id;
}

ui.step.addEventListener('click', () => {
  const name = `${fileStem()}.step`;
  const request: BuildRequest = { type: 'step', id: nextId++, part: part.id, params: partChanges() };
  stepRequests.set(request.id, name);
  ui.step.disabled = true;
  setStatus('busy', 'Writing the STEP file…');
  worker.postMessage(request);
});

function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  saveUrl(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  setStatus('done', `Saved ${name}.`);
}

function saveUrl(url: string, name: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

function setStatus(kind: 'busy' | 'done' | 'warning' | 'error', text: string): void {
  const sentence = /[.…!?)%]$/.test(text) ? text : `${text}.`;
  ui.status.dataset.kind = kind;
  ui.status.textContent = sentence;
  // Over the preview too, where the eye is, while it's busy or has nothing to show.
  const overlay = kind === 'busy' || kind === 'error';
  ui.overlay.hidden = !overlay;
  ui.overlay.dataset.kind = kind;
  ui.overlay.textContent = overlay ? sentence : '';
}

function renderKernel(): void {
  const mb = (bytes: number) => (bytes / 1e6).toFixed(1);
  ui.kernel.dataset.state = kernel.state;
  switch (kernel.state) {
    case 'loading':
      ui.kernel.textContent =
        kernel.loaded > 0
          ? `Geometry kernel: loading, ${mb(kernel.loaded)} of ${mb(kernel.total)} MB`
          : 'Geometry kernel: starting';
      if (previewWanted) setStatus('busy', `Loading the geometry kernel: ${Math.round((100 * kernel.loaded) / kernel.total)}%`);
      break;
    case 'ready':
      ui.kernel.textContent = 'Geometry kernel: ready';
      break;
    case 'unavailable':
      ui.kernel.textContent = 'Geometry kernel: unavailable in this browser';
      renderForm(); // disabled: nothing can be built
      break;
  }
}

// ---------------------------------------------------------------------------
// The accessory picker, the part tabs and the form
// ---------------------------------------------------------------------------

function renderAccessories(): void {
  ui.accessoryList.replaceChildren(
    ...accessories.map((info) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'accessory';
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(info === accessory));
      button.innerHTML = `<img src="${info.image}" alt="" width="400" height="300" loading="lazy"><span class="accessory-title"></span>`;
      button.querySelector('.accessory-title')!.textContent = info.title;
      button.addEventListener('click', () => choose(info, info.parts[0]!));
      return button;
    }),
  );
}

function choose(info: AccessoryInfo, chosen: PartInfo): void {
  if (info === accessory && chosen === part) return;
  // The fit tolerance is the printer's, not the part's: carry it across.
  const fit = changed().fitTolerance;
  accessory = info;
  part = chosen;
  if (fit !== undefined && 'fitTolerance' in schemaFor(info)) {
    changes.set(info.id, { ...changed(), fitTolerance: fit });
  }
  renderAccessories();
  renderPart();
  refresh();
}

function renderPart(): void {
  ui.title.textContent = accessory.title;
  ui.summary.textContent = accessory.summary;
  ui.doc.href = docUrl(accessory);
  ui.count.textContent = accessory.parts.length > 1 ? `${part.title}: ${part.count.toLowerCase()}` : part.count;

  ui.tabs.hidden = accessory.parts.length < 2;
  ui.tabs.replaceChildren(
    ...accessory.parts.map((p) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(p === part));
      tab.textContent = p.title;
      tab.addEventListener('click', () => choose(accessory, p));
      return tab;
    }),
  );
  renderForm();
}

function renderForm(): void {
  const d = data();
  ui.reset.disabled = Object.keys(changed()).length === 0;
  if (!d) {
    ui.form.replaceChildren(note('Loading the dimensions…'));
    return;
  }
  const disabled = kernel.state === 'unavailable';

  // A section per group, in the order the schema first names each, of the
  // fields that apply to the part as it stands.
  const values = { ...d.defaults, ...changed() };
  const groups = new Map<string, [string, ParamSpec][]>();
  for (const entry of Object.entries(d.schema)) {
    if (!applies(entry[1], values)) continue;
    const group = entry[1].group ?? 'Dimensions';
    groups.set(group, [...(groups.get(group) ?? []), entry]);
  }

  const sections: HTMLElement[] = [];
  if (part.id === 'stack-locator') sections.push(note('Nothing to change: the locator is the registration boss itself, and the pockets in the keys take the fit tolerance.'));
  else if (part.id === 'ego-battery-holder') sections.push(note('The rails match EGO’s own wall mounts, so their dimensions are fixed.'));
  for (const [legend, entries] of groups) sections.push(fieldset(legend, entries, d, disabled));
  ui.form.replaceChildren(...sections);
}

function note(text: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

function fieldset(legend: string, entries: [string, ParamSpec][], d: PartData, disabled: boolean): HTMLElement {
  const set = document.createElement('fieldset');
  set.disabled = disabled;
  const title = document.createElement('legend');
  title.textContent = legend;
  set.append(title, ...entries.map(([name, spec]) => field(name, spec, d.defaults[name] ?? 0)));
  return set;
}

function field(name: string, spec: ParamSpec, fallback: number): HTMLElement {
  if (spec.kind === 'toggle') return toggleField(name, spec, fallback);
  if (spec.kind === 'choice') return choiceField(name, spec, fallback);
  return dimensionField(name, spec, fallback);
}

/** A row of options, for a choice between forms of a feature. */
function choiceField(name: string, spec: ChoiceSpec, fallback: number): HTMLElement {
  const value = changed()[name] ?? fallback;
  const row = document.createElement('div');
  row.className = 'field';
  row.dataset.changed = String(!same(value, fallback));
  row.innerHTML = `
    <div class="field-head"><span class="field-name" id="label-${name}"></span></div>
    <div class="segmented" role="radiogroup" aria-labelledby="label-${name}"></div>
    <p class="help"></p>`;
  row.querySelector('.field-name')!.textContent = spec.label;
  row.querySelector('.help')!.textContent = spec.help ?? '';
  row.querySelector('.segmented')!.append(
    ...spec.options.map((option) => {
      const label = document.createElement('label');
      label.innerHTML = `<input type="radio" name="param-${name}"><span></span>`;
      const input = label.querySelector('input')!;
      input.value = String(option.value);
      input.checked = same(option.value, value);
      label.querySelector('span')!.textContent = option.label;
      input.addEventListener('change', () => {
        if (!input.checked) return;
        setValue(name, option.value, fallback);
        // Other fields may now apply, or stop applying: draw them again.
        renderForm();
        ui.form.querySelector<HTMLInputElement>(`input[name="param-${name}"][value="${option.value}"]`)?.focus();
      });
      return label;
    }),
  );
  return row;
}

/** Sets a value, dropping it once it's back to its default. */
function setValue(name: string, next: number, fallback: number): void {
  const values = { ...changed() };
  if (same(next, fallback)) delete values[name];
  else values[name] = next;
  // The fit tolerance goes on every accessory, so a printer's setting sticks.
  if (name === 'fitTolerance') {
    for (const info of accessories) {
      if (info === accessory || !('fitTolerance' in schemaFor(info))) continue;
      const other = { ...(changes.get(info.id) ?? {}) };
      if (same(next, fallback)) delete other.fitTolerance;
      else other.fitTolerance = next;
      changes.set(info.id, other);
    }
  }
  changes.set(accessory.id, values);
  ui.reset.disabled = Object.keys(values).length === 0;
  refresh(true);
}

/** A switch, for a feature the part can leave off. */
function toggleField(name: string, spec: ToggleSpec, fallback: number): HTMLElement {
  const id = `param-${name}`;
  const value = changed()[name] ?? fallback;
  const row = document.createElement('div');
  row.className = 'field';
  row.dataset.changed = String(!same(value, fallback));
  row.innerHTML = `
    <label class="switch" for="${id}">
      <input type="checkbox" role="switch" id="${id}">
      <span class="switch-track" aria-hidden="true"></span>
      <span class="switch-label field-name"></span>
    </label>
    <p class="help"></p>`;
  const input = row.querySelector('input')!;
  input.checked = on(value);
  row.querySelector('.switch-label')!.textContent = spec.label;
  row.querySelector('.help')!.textContent = spec.help ?? '';
  input.addEventListener('change', () => {
    const next = input.checked ? 1 : 0;
    row.dataset.changed = String(!same(next, fallback));
    setValue(name, next, fallback);
  });
  return row;
}

/** A slider and a number box, for a dimension within its range. */
function dimensionField(name: string, spec: DimensionSpec, fallback: number): HTMLElement {
  const id = `param-${name}`;
  const value = changed()[name] ?? fallback;
  const row = document.createElement('div');
  row.className = 'field';
  row.dataset.changed = String(!same(value, fallback));
  row.innerHTML = `
    <div class="field-head">
      <label class="field-name" for="${id}"></label>
      <button type="button" class="field-reset" title="Back to the default">default <span></span></button>
    </div>
    <div class="field-inputs">
      <input type="range" aria-hidden="true" tabindex="-1">
      <span class="number"><input type="number" id="${id}" inputmode="decimal"><span class="unit"></span></span>
    </div>
    <p class="help"></p>
    <p class="field-error" hidden></p>`;
  const [range, number] = row.querySelectorAll('input') as unknown as [HTMLInputElement, HTMLInputElement];
  row.querySelector('label')!.textContent = spec.label;
  row.querySelector('.unit')!.textContent = spec.unit;
  row.querySelector('.field-reset span')!.textContent = `${format(fallback)} ${spec.unit}`;
  const help = row.querySelector<HTMLElement>('.help')!;
  help.textContent = `${spec.help ?? ''} ${format(spec.min)}–${format(spec.max)} ${spec.unit}.`.trim();
  const error = row.querySelector<HTMLElement>('.field-error')!;
  for (const input of [range, number]) {
    input.min = String(spec.min);
    input.max = String(spec.max);
    input.step = String(spec.step);
    input.value = String(value);
  }

  const set = (next: number) => {
    row.dataset.changed = String(!same(next, fallback));
    setValue(name, next, fallback);
  };

  range.addEventListener('input', () => {
    number.value = range.value;
    error.hidden = true;
    number.removeAttribute('aria-invalid');
    set(Number(range.value));
  });
  number.addEventListener('input', () => {
    const next = Number(number.value);
    const valid = number.value !== '' && Number.isFinite(next) && next >= spec.min && next <= spec.max;
    error.hidden = valid;
    if (valid) number.removeAttribute('aria-invalid');
    else number.setAttribute('aria-invalid', 'true');
    error.textContent = `Between ${format(spec.min)} and ${format(spec.max)} ${spec.unit}.`;
    if (!valid) return;
    range.value = number.value;
    set(next);
  });
  row.querySelector('.field-reset')!.addEventListener('click', () => {
    range.value = number.value = String(fallback);
    error.hidden = true;
    number.removeAttribute('aria-invalid');
    set(fallback);
  });
  return row;
}

const format = (v: number) => String(Math.round(v * 1000) / 1000);

// ---------------------------------------------------------------------------
// Buttons, and starting up
// ---------------------------------------------------------------------------

ui.reset.addEventListener('click', () => {
  const fit = changed().fitTolerance;
  changes.set(accessory.id, {});
  // Reset this accessory's fit too, everywhere it was carried.
  if (fit !== undefined) for (const values of changes.values()) delete values.fitTolerance;
  renderForm();
  refresh();
});

ui.copy.addEventListener('click', async () => {
  writeHash();
  try {
    await navigator.clipboard.writeText(location.href);
    ui.copy.textContent = 'Link copied';
  } catch {
    ui.copy.textContent = 'Copy the address bar';
  }
  setTimeout(() => (ui.copy.textContent = 'Copy link'), 2000);
});

ui.resetView.addEventListener('click', () => viewer.resetView());

ui.stl.addEventListener('click', (event) => {
  if (ui.stl.getAttribute('aria-disabled') === 'true') event.preventDefault();
});

window.addEventListener('hashchange', () => {
  readHash();
  renderAccessories();
  renderPart();
  refresh();
});

matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => viewer.theme());

readHash();
renderAccessories();
renderPart();
renderKernel();
refresh();
