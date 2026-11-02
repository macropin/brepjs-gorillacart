/**
 * Side panel.
 *
 * A flat plate that slides down into the grooves of two neighbouring side
 * extension posts on the same side of the cart, filling the wall between them.
 * Five are needed: two on each long side and one across the handle end.
 *
 * Modelled flat, as printed: X along the panel's length (post to post), Y up
 * its height once fitted, Z through its thickness. Centred on the origin in X/Y,
 * lying on the print bed at z = 0.
 */
import { box, type ValidSolid } from 'brepjs';

import { cart, cutoutPitch, plug } from './cart.js';
import { params as post } from './side-extension.brep.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Height up the panel, matching the posts above the rim. */
  height: post.extension,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** Groove width less the fit tolerance: 4 - 0.3 = 3.7. */
export const thickness = post.grooveWidth - cart.fitTolerance;

/**
 * Groove floor to groove floor between neighbouring posts, less the fit
 * tolerance: 330.7 - 2 * (25.5 - 8) - 0.3 = 295.4.
 */
export const length =
  cutoutPitch - 2 * (plug.y / 2 - post.grooveDepth) - cart.fitTolerance;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function sidePanel(): ValidSolid {
  return box(length, params.height, thickness, {
    centered: true,
    at: [0, 0, thickness / 2],
  });
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

export const expected = {
  volume: length * params.height * thickness,
  bounds: {
    xMin: -length / 2,
    xMax: length / 2,
    yMin: -params.height / 2,
    yMax: params.height / 2,
    zMin: 0,
    zMax: thickness,
  },
  tolerancePct: 0.1,
};
