/**
 * Handle-end panel.
 *
 * The side panel, cut to the span between the two handle-end posts. Their
 * cutouts sit a little closer together than those along the long sides, so the
 * side panel is too long to fit here. One is needed.
 *
 * Modelled flat, as printed, with the same axes as ./side-panel.brep.ts.
 */
import { box, type ValidSolid } from 'brepjs';

import { cart, handleEndPitch, plug } from './cart.js';
import { params as post } from './side-extension.brep.js';
import { params as panel, thickness } from './side-panel.brep.js';

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/**
 * Groove floor to groove floor between the handle-end posts, less the fit
 * tolerance: 326.8 - 2 * (25.5 - 8) - 0.3 = 291.5.
 */
export const length =
  handleEndPitch - 2 * (plug.y / 2 - post.grooveDepth) - cart.fitTolerance;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function endPanel(): ValidSolid {
  return box(length, panel.height, thickness, {
    centered: true,
    at: [0, 0, thickness / 2],
  });
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

export const expected = {
  volume: length * panel.height * thickness,
  bounds: {
    xMin: -length / 2,
    xMax: length / 2,
    yMin: -panel.height / 2,
    yMax: panel.height / 2,
    zMin: 0,
    zMax: thickness,
  },
  tolerancePct: 0.1,
};
