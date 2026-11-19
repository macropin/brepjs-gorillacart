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

import { cart, cutoutPitch } from './cart.js';
import { defaults, design as postDesign, kitSchema, type KitParams } from './side-extension.brep.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/** The kit's: the panel is sized from the posts it slots into. */
export { defaults };
export const schema = kitSchema;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function design(params: KitParams = defaults) {
  const { plug, lipSize } = postDesign(params);

  /** Height up the panel, matching the posts above the rim. */
  const height = params.extension;

  /** Groove width less the fit tolerance: 4 - 0.3 = 3.7. */
  const thickness = params.grooveWidth - params.fitTolerance;

  /**
   * Groove floor to groove floor between neighbouring posts, less the fit
   * tolerance: 330.7 - 2 * (25.5 - 8) - 0.3 = 295.4.
   */
  const length = cutoutPitch - 2 * (plug.y / 2 - params.grooveDepth) - params.fitTolerance;

  /**
   * The lip at each end. It stands off the panel's face by the recess's full
   * depth: the panel already sits 0.15 off each groove wall, which leaves the
   * lip 0.15 clear of the recess's far wall. Along the panel it is the recess
   * less the fit tolerance: 0.15 clear of the groove floor (as the panel end
   * is) and 0.15 short of the shoulder.
   */
  const lipStandoff = lipSize; // 4
  const lipLength = lipSize - params.fitTolerance; // 3.7

  /**
   * The middle of the bottom edge, dropped to the lower rim between the landings
   * beside the cutouts: 279.4 - 2 * 20 = 239.4 of rim, less the fit tolerance,
   * so it is 0.15 clear of each landing. It drops the rim's full step, to sit on
   * the lower rim as the ends sit on the groove floors. Each end stays undropped
   * for 28.15 from the panel's end: 8 over the cutout, in the groove, and 20.15
   * over the landing.
   */
  const dropLength = cart.cutoutGap - 2 * cart.landingLength - params.fitTolerance; // 239.1
  const dropDepth = cart.rimDrop; // 1.5

  function model(): ValidSolid {
    const plate = box(length, height, thickness, {
      centered: true,
      at: [0, 0, thickness / 2],
    });
    const lip = (side: 1 | -1) =>
      box(lipLength, height, lipStandoff, {
        centered: true,
        at: [side * (length - lipLength) / 2, 0, thickness + lipStandoff / 2],
      });
    const drop = box(dropLength, dropDepth, thickness, {
      centered: true,
      at: [0, -(height + dropDepth) / 2, thickness / 2],
    });

    let panel = plate;
    for (const part of [lip(1), lip(-1), drop]) {
      panel = single(unwrap(fuse(panel, part)));
    }
    return panel;
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const expected = {
    volume:
      (length * thickness + 2 * lipLength * lipStandoff) * height +
      dropLength * dropDepth * thickness,
    bounds: {
      xMin: -length / 2,
      xMax: length / 2,
      yMin: -height / 2 - dropDepth,
      yMax: height / 2,
      zMin: 0,
      zMax: thickness + lipStandoff,
    },
    tolerancePct: 0.1,
  };

  return {
    model,
    expected,
    height,
    thickness,
    length,
    lipStandoff,
    lipLength,
    dropLength,
    dropDepth,
  };
}

const standard = design();

export default function sidePanel(): ValidSolid {
  return standard.model();
}

export const { expected, height, thickness, length, lipStandoff, lipLength, dropLength, dropDepth } =
  standard;
