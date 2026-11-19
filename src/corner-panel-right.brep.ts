/**
 * Corner panel for the right handle-end corner: on your right when you stand at
 * the handle end facing the tub. The left panel mirrored across the long side's
 * line. See ./corner-panel.ts.
 */
import { mirror, type ValidSolid } from 'brepjs';

import { cornerPanelDesign } from './corner-panel.js';
import { defaults, kitSchema, type KitParams } from './side-extension.brep.js';

/** The kit's: the panel is sized from the posts it slots into. */
export { defaults };
export const schema = kitSchema;

export function design(params: KitParams = defaults) {
  const left = cornerPanelDesign(params);
  const model = (): ValidSolid => mirror(left.model(), { normal: [0, 1, 0] });

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const { extent } = left;
  const expected = {
    volume: left.volume,
    bounds: { ...extent, yMin: -extent.yMax, yMax: -extent.yMin },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export default function cornerPanelRight(): ValidSolid {
  return standard.model();
}

export const { expected } = standard;
