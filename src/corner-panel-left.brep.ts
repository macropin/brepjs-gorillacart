/**
 * Corner panel for the left handle-end corner: on your left when you stand at
 * the handle end facing the tub. See ./corner-panel.ts.
 */
import { type ValidSolid } from 'brepjs';

import { cornerPanel, extent, volume } from './corner-panel.js';

export default function cornerPanelLeft(): ValidSolid {
  return cornerPanel();
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

export const expected = {
  volume,
  bounds: extent,
  tolerancePct: 0.1,
};
