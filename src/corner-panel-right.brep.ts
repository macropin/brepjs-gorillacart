/**
 * Corner panel for the right handle-end corner: on your right when you stand at
 * the handle end facing the tub. The left panel mirrored across the long side's
 * line. See ./corner-panel.ts.
 */
import { mirror, type ValidSolid } from 'brepjs';

import { cornerPanel, extent, volume } from './corner-panel.js';

export default function cornerPanelRight(): ValidSolid {
  return mirror(cornerPanel(), { normal: [0, 1, 0] });
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

export const expected = {
  volume,
  bounds: { ...extent, yMin: -extent.yMax, yMax: -extent.yMin },
  tolerancePct: 0.1,
};
