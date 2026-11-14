/**
 * Tie-down block.
 *
 * Gives a load something to strap to. The key bar drops into a rim cutout; on
 * top sits a head that rests on the rim either side of the cutout and carries
 * two holes for a strap, rope or hook to pass through. Fit as many as needed,
 * one per cutout.
 *
 * It is held in by friction alone; pinning it would mean drilling the cart. In
 * use a strap through one hole, run down to the cart, pulls it into place.
 *
 * The idea follows the wagon cargo tie-down blocks sold for these carts: a
 * plug, a head wider than the pocket along the rim, and holes across it. The
 * geometry here is our own, built on the shared key.
 *
 * The head is no thicker than the key across the rim, so both broad faces are
 * flat and flush: the block prints lying on one of them with the holes upright,
 * and needs no supports.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it. The rim is at z = insertDepth.
 */
import {
  chamfer,
  curvePointAt,
  cut,
  cylinder,
  edgeFinder,
  fuse,
  Sketcher,
  unwrap,
  type Edge,
  type ValidSolid,
} from 'brepjs';

import { cart, plug } from './cart.js';
import { key, keySectionArea } from './key.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /**
   * Head, seen from inside the cart: a trapezoid standing on the rim, longer
   * along the rim at the base than the key so it bears on the rim at both
   * ends of the cutout.
   */
  headBase: 72,
  headTop: 56,
  headHeight: 40,

  /** Rounds the head's two top corners in its profile. */
  headCornerRadius: 6,

  /** Strap holes through the head, across the rim. */
  holeDiameter: 20,
  holeSpacing: 28, // centre to centre, along the rim
  holeHeight: 20, // centre, above the rim

  /** Breaks every edge of the head's broad faces, hole mouths included, so a strap has no sharp edge to wear on. */
  edgeChamfer: 1,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const rim = params.insertDepth; // 63.5
const top = rim + params.headHeight; // 103.5
const holeR = params.holeDiameter / 2;
const holeZ = rim + params.holeHeight;
const thickness = plug.x; // 19.2, flush with the key

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/**
 * Material left around the holes: between them, out to the sloping ends
 * (measured square to the slope, where it is thinnest), above, and below to
 * the rim.
 */
const slope = (params.headBase - params.headTop) / 2 / params.headHeight;
export const webBetweenHoles = params.holeSpacing - params.holeDiameter; // 8
export const wallToEnd =
  (params.headBase / 2 - params.holeSpacing / 2 - slope * params.holeHeight) /
    Math.hypot(1, slope) -
  holeR; // 7.7
export const wallAbove = params.headHeight - params.holeHeight - holeR; // 10
export const wallBelow = params.holeHeight - holeR; // 10

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function tieDownBlock(): ValidSolid {
  // The head's profile on the YZ plane (u = Y, v = Z), extruded across the rim
  // from one broad face of the key to the other.
  const head = new Sketcher('YZ', -thickness / 2)
    .movePointerTo([-params.headBase / 2, rim])
    .lineTo([params.headBase / 2, rim])
    .lineTo([params.headTop / 2, top])
    .customCorner(params.headCornerRadius)
    .lineTo([-params.headTop / 2, top])
    .customCorner(params.headCornerRadius)
    .close()
    .extrude(thickness);

  const block = single(unwrap(fuse(key(params.insertDepth), single(head))));

  const hole = (y: number) =>
    cylinder(holeR, thickness + 2 * OVER, {
      at: [-thickness / 2 - OVER, y, holeZ],
      axis: [1, 0, 0],
    });
  let part = single(unwrap(cut(block, hole(-params.holeSpacing / 2))));
  part = single(unwrap(cut(part, hole(params.holeSpacing / 2))));

  if (params.edgeChamfer <= 0) return part;

  // Every edge on the two broad faces above the rim: the head's outline and the
  // hole mouths. The base of the head, where it meets the rim, is left square
  // so it sits flat.
  const onHeadFace = (edge: Edge) => {
    const [x, , z] = curvePointAt(edge, 0.5);
    return Math.abs(Math.abs(x) - thickness / 2) < 1e-6 && z > rim + 1e-6;
  };
  return single(unwrap(chamfer(part, edgeFinder().when(onHeadFace), params.edgeChamfer)));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// Key below the rim plus the head's profile across its thickness, less the two
// holes. Each rounded top corner trims r²·(tan(θ/2) − θ/2) from the trapezoid,
// θ being the turn at that corner. The edge chamfer takes a further sliver,
// within the tolerance.
const turn = Math.PI / 2 - Math.atan(slope);
const cornerLoss = params.headCornerRadius ** 2 * (Math.tan(turn / 2) - turn / 2);
const profileArea =
  ((params.headBase + params.headTop) / 2) * params.headHeight - 2 * cornerLoss;

export const expected = {
  volume:
    keySectionArea * params.insertDepth +
    (profileArea - 2 * Math.PI * holeR ** 2) * thickness,
  bounds: {
    xMin: -thickness / 2,
    xMax: thickness / 2,
    yMin: -params.headBase / 2,
    yMax: params.headBase / 2,
    zMin: 0,
    zMax: top,
  },
  tolerancePct: 0.5,
};
