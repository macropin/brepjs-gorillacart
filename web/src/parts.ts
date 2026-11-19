// The part modules, for the worker. Each builds its part from any parameters
// in range: see src/params.ts.

import type { ValidSolid } from 'brepjs';

import * as cornerPanelLeft from '../../src/corner-panel-left.brep.js';
import * as cornerPanelRight from '../../src/corner-panel-right.brep.js';
import * as egoBatteryHolder from '../../src/ego-battery-holder.brep.js';
import * as macheteSleeve from '../../src/machete-sleeve.brep.js';
import type { ParamSpec } from '../../src/params.js';
import * as poleHolder from '../../src/pole-holder.brep.js';
import * as sideExtension from '../../src/side-extension.brep.js';
import * as sidePanel from '../../src/side-panel.brep.js';
import * as stackLocator from '../../src/stack-locator.brep.js';
import * as tieDownBlock from '../../src/tie-down-block.brep.js';
import type { Params } from './protocol.js';

/** A part's declared intent, as `brep verify --check` asserts it. */
export interface Expected {
  volume: number;
  bounds: Record<'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax', number>;
  tolerancePct: number;
}

interface Built {
  model(): ValidSolid;
  expected: Expected;
}

export interface PartModule {
  defaults: Readonly<Params>;
  schema: Readonly<Record<string, ParamSpec | undefined>>;
  design(params: Params): Built;
}

/**
 * Each module's `design` takes its own parameters. The worker passes them as
 * plain numbers by name, merged over the module's own defaults, so widen it:
 * this checks the module's shape, not its parameter names.
 */
function widen(module: {
  defaults: Readonly<Record<string, number>>;
  schema: Readonly<Record<string, ParamSpec | undefined>>;
  design(params: never): Built;
}): PartModule {
  return module as unknown as PartModule;
}

export const parts: Record<string, PartModule> = {
  'side-extension': widen(sideExtension),
  'side-panel': widen(sidePanel),
  'corner-panel-left': widen(cornerPanelLeft),
  'corner-panel-right': widen(cornerPanelRight),
  'stack-locator': widen(stackLocator),
  'tie-down-block': widen(tieDownBlock),
  'pole-holder': widen(poleHolder),
  'machete-sleeve': widen(macheteSleeve),
  'ego-battery-holder': widen(egoBatteryHolder),
};
