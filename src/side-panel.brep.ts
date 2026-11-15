/**
 * Side panel.
 *
 * A flat plate that slides down into the grooves of two neighbouring side
 * extension posts on the same side of the cart, filling the wall between them.
 * Five are needed: two on each long side and one across the handle end.
 *
 * Each end carries a lip down its full height, standing off the face that goes
 * on the inside of the cart. It drops into the recess at the bottom of the
 * post's groove, so the panel can't pull out of the groove along its length.
 * The lips are on one face only, so the other face is flat to print on.
 *
 * Modelled flat, as printed: X along the panel's length (post to post), Y up
 * its height once fitted, Z through its thickness, lips up. Centred on the
 * origin in X/Y, its outside face on the print bed at z = 0.
 */
import { box, fuse, unwrap, type ValidSolid } from 'brepjs';

import { cart, cutoutPitch, plug } from './cart.js';
import { lipSize, params as post } from './side-extension.brep.js';
import { single } from './solid.js';

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

/**
 * The lip at each end. It stands off the panel's face by the recess's full
 * depth: the panel already sits 0.15 off each groove wall, which leaves the
 * lip 0.15 clear of the recess's far wall. Along the panel it is the recess
 * less the fit tolerance: 0.15 clear of the groove floor (as the panel end
 * is) and 0.15 short of the shoulder.
 */
export const lipStandoff = lipSize; // 4
export const lipLength = lipSize - cart.fitTolerance; // 3.7

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function sidePanel(): ValidSolid {
  const plate = box(length, params.height, thickness, {
    centered: true,
    at: [0, 0, thickness / 2],
  });
  const lip = (side: 1 | -1) =>
    box(lipLength, params.height, lipStandoff, {
      centered: true,
      at: [side * (length - lipLength) / 2, 0, thickness + lipStandoff / 2],
    });
  return single(unwrap(fuse(single(unwrap(fuse(plate, lip(1)))), lip(-1))));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

export const expected = {
  volume: (length * thickness + 2 * lipLength * lipStandoff) * params.height,
  bounds: {
    xMin: -length / 2,
    xMax: length / 2,
    yMin: -params.height / 2,
    yMax: params.height / 2,
    zMin: 0,
    zMax: thickness + lipStandoff,
  },
  tolerancePct: 0.1,
};
