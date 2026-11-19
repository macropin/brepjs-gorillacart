/**
 * Corner panel for the left handle-end corner: on your left when you stand at
 * the handle end facing the tub. See ./corner-panel.ts.
 */
import { type ValidSolid } from 'brepjs';

import { cornerPanelDesign } from './corner-panel.js';
import { defaults, kitSchema, type KitParams } from './side-extension.brep.js';

/** The kit's: the panel is sized from the posts it slots into. */
export { defaults };
export const schema = kitSchema;

export function design(params: KitParams = defaults) {
  const { model, volume, extent } = cornerPanelDesign(params);

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const expected = {
    volume,
    bounds: extent,
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export default function cornerPanelLeft(): ValidSolid {
  return standard.model();
}

export const { expected } = standard;
