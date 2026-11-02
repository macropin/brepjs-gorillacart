/**
 * Corner panel.
 *
 * Closes a handle-end corner of the cart: an L-shaped panel that slides into the
 * groove of the long-side post nearest the handle end with one leg, and into
 * the groove of the handle-end post on that side with the other. The legs meet
 * in a rounded bend rather than a sharp corner.
 *
 * Each leg leans 3° outward to sit in its posts' grooves, so the bend is a
 * slice of a cone, flaring like the corners of the bucket itself. Both legs stay
 * the same length top to bottom, so their ends sit square in the grooves.
 *
 * Modelled as fitted and as printed, standing on its bottom edge. Z is up from
 * the rim (the groove floors) at z = 0. The origin is where the two legs' centre
 * planes cross at the bottom. Leg A runs along +X to the long-side post and
 * leans toward +Y; leg B runs along -Y to the handle-end post and leans toward
 * -X. The outside of the bend faces -X/+Y.
 */
import { Sketcher, type Sketch, type ValidSolid } from 'brepjs';

import { cart, corner, plug } from './cart.js';
import { params as post } from './side-extension.brep.js';
import { thickness } from './side-panel.brep.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Height up the panel, matching the posts and side panels. */
  height: post.extension,

  /** Bend radius on the panel's centreline, at the bottom. */
  bendRadius: 50,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const rad = (post.lean * Math.PI) / 180;

/** Vertical height, and how far each leg has leaned out by the top. */
const rise = params.height * Math.cos(rad); // 149.79
const lean = params.height * Math.sin(rad); // 7.85

/**
 * Half the panel's thickness measured horizontally. The legs lean, so this is
 * a touch wider than half of `thickness`, which is measured square to the leg.
 */
const halfWidth = thickness / Math.cos(rad) / 2;

/** Post centre to its groove floor, along the rim. */
const toGrooveFloor = plug.y / 2 - post.grooveDepth; // 17.5

/**
 * Leg ends, from the corner: each stops short of its groove floor by half the
 * fit tolerance, as the side panel does at each end.
 */
const endA = corner.along - toGrooveFloor - cart.fitTolerance / 2; // 144.5
const endB = corner.across - toGrooveFloor - cart.fitTolerance / 2; // 144.5

const R = params.bendRadius;

// The bend must stay clear of the posts, finishing before either leg reaches
// a post's face.
if (R + halfWidth > Math.min(corner.along, corner.across) - plug.y / 2) {
  throw new Error(`bendRadius ${R} runs the bend into a post`);
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function cornerPanel(): ValidSolid {
  // Bottom and top sections share their topology edge for edge, so a ruled loft
  // joins straight to straight (planes) and arc to arc (a cone).
  const bottom = section(0, 0);
  const top = section(rise, lean);
  return single(bottom.loftWith(top, { ruled: true }));
}

/**
 * The panel's horizontal section at height `z`, where each leg has leaned out
 * by `out`. The bend keeps its centre and grows its radius by `out`, so the
 * straight runs stay the same length.
 */
function section(z: number, out: number): Sketch {
  const outer = R + out + halfWidth;
  const inner = R + out - halfWidth;
  const c = Math.SQRT1_2;
  return new Sketcher('XY', z)
    .movePointerTo([endA, out + halfWidth])
    .lineTo([R, out + halfWidth])
    .threePointsArcTo([-out - halfWidth, -R], [R - outer * c, -R + outer * c])
    .lineTo([-out - halfWidth, -endB])
    .lineTo([-out + halfWidth, -endB])
    .lineTo([-out + halfWidth, -R])
    .threePointsArcTo([R, out - halfWidth], [R - inner * c, -R + inner * c])
    .lineTo([endA, out - halfWidth])
    .close();
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// Each horizontal section is a strip of constant width along the centreline:
// two straight runs plus a quarter circle whose radius grows linearly with
// height. Its volume is the width times the centreline length at mid-height.
const centreline = endA + endB - 2 * R + (Math.PI / 2) * (R + lean / 2);

export const expected = {
  volume: 2 * halfWidth * centreline * rise,
  bounds: {
    xMin: -lean - halfWidth,
    xMax: endA,
    yMin: -endB,
    yMax: lean + halfWidth,
    zMin: 0,
    zMax: rise,
  },
  tolerancePct: 0.1,
};
