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
 * The bottom edge follows the rim. Next to each post the rim is level with the
 * groove floors; further from the posts it sits lower, so the middle of the
 * bottom edge drops to meet it.
 *
 * Modelled flat, as printed: X along the panel's length (post to post), Y up
 * its height once fitted, Z through its thickness, lips up. The plate is
 * centred on the origin in X/Y, its outside face on the print bed at z = 0.
 * The dropped middle hangs below it.
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

/**
 * The middle of the bottom edge, dropped to the lower rim between the landings
 * beside the cutouts: 279.4 - 2 * 20 = 239.4 of rim, less the fit tolerance,
 * so it is 0.15 clear of each landing. It drops the rim's full step, to sit on
 * the lower rim as the ends sit on the groove floors. Each end stays undropped
 * for 28.15 from the panel's end: 8 over the cutout, in the groove, and 20.15
 * over the landing.
 */
export const dropLength = cart.cutoutGap - 2 * cart.landingLength - cart.fitTolerance; // 239.1
export const dropDepth = cart.rimDrop; // 1.5

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
  const drop = box(dropLength, dropDepth, thickness, {
    centered: true,
    at: [0, -(params.height + dropDepth) / 2, thickness / 2],
  });

  let panel = plate;
  for (const part of [lip(1), lip(-1), drop]) {
    panel = single(unwrap(fuse(panel, part)));
  }
  return panel;
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

export const expected = {
  volume:
    (length * thickness + 2 * lipLength * lipStandoff) * params.height +
    dropLength * dropDepth * thickness,
  bounds: {
    xMin: -length / 2,
    xMax: length / 2,
    yMin: -params.height / 2 - dropDepth,
    yMax: params.height / 2,
    zMin: 0,
    zMax: thickness + lipStandoff,
  },
  tolerancePct: 0.1,
};
