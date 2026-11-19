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
 * The key carries the stacking bolt holes and registration pockets
 * (./stacking.ts), so the block can bolt to a side extension post instead, as a
 * strap point above the raised walls.
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

import { keyStackingSchema, stacking, stackingDefaults, stackingFeatures } from './stacking.js';
import { cart, plugFor } from './cart.js';
import { key, keySectionArea } from './key.js';
import { atLeast, fitToleranceSpec, type Numeric, type Schema } from './params.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const defaults = {
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

  /** Printed-fit slop, taken off the cutout's width and length. */
  fitTolerance: cart.fitTolerance,

  /** The stacking features (./stacking.ts): 1 to include each, 0 to leave it off. */
  boltHoles: stackingDefaults.boltHoles,
  registration: stackingDefaults.registration,
} as const;

export type Params = Numeric<typeof defaults>;

export const schema: Schema<Params> = {
  holeDiameter: {
    label: 'Strap hole diameter',
    unit: 'mm',
    min: 10,
    max: 24,
    step: 0.5,
    help: 'Both holes. Big enough for the hook, rope or strap you tie down with.',
  },
  ...keyStackingSchema,
  fitTolerance: fitToleranceSpec,
};

/** Least material left round the strap holes. */
const MIN_WALL = 3;

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function design(params: Params = defaults) {
  const plug = plugFor(params.fitTolerance);
  const { keyStackingCuts, keyStackingDelta } = stacking(params.fitTolerance, stackingFeatures(params));

  const rim = params.insertDepth; // 63.5
  const top = rim + params.headHeight; // 103.5
  const holeR = params.holeDiameter / 2;
  const holeZ = rim + params.holeHeight;
  const thickness = plug.x; // 19.2, flush with the key

  /**
   * Material left around the holes: between them, out to the sloping ends
   * (measured square to the slope, where it is thinnest), above, and below to
   * the rim.
   */
  const slope = (params.headBase - params.headTop) / 2 / params.headHeight;
  const webBetweenHoles = params.holeSpacing - params.holeDiameter; // 8
  const wallToEnd =
    (params.headBase / 2 - params.holeSpacing / 2 - slope * params.holeHeight) /
      Math.hypot(1, slope) -
    holeR; // 7.7
  const wallAbove = params.headHeight - params.holeHeight - holeR; // 10
  const wallBelow = params.holeHeight - holeR; // 10

  atLeast('The web between the strap holes', webBetweenHoles, MIN_WALL);
  atLeast('The wall outside each strap hole', wallToEnd, MIN_WALL);
  atLeast('The wall above the strap holes', wallAbove, MIN_WALL);
  atLeast('The wall below the strap holes', wallBelow, MIN_WALL);

  function model(): ValidSolid {
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

    const block = single(unwrap(fuse(key(params.insertDepth, plug), single(head))));

    const hole = (y: number) =>
      cylinder(holeR, thickness + 2 * OVER, {
        at: [-thickness / 2 - OVER, y, holeZ],
        axis: [1, 0, 0],
      });
    let part = single(unwrap(cut(block, hole(-params.holeSpacing / 2))));
    part = single(unwrap(cut(part, hole(params.holeSpacing / 2))));

    if (params.edgeChamfer <= 0) return keyStackingCuts(part);

    // Every edge on the two broad faces above the rim: the head's outline and the
    // hole mouths. The base of the head, where it meets the rim, is left square
    // so it sits flat.
    const onHeadFace = (edge: Edge) => {
      const [x, , z] = curvePointAt(edge, 0.5);
      return Math.abs(Math.abs(x) - thickness / 2) < 1e-6 && z > rim + 1e-6;
    };
    const chamfered = single(
      unwrap(chamfer(part, edgeFinder().when(onHeadFace), params.edgeChamfer)),
    );
    return keyStackingCuts(chamfered);
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  // Key below the rim plus the head's profile across its thickness, less the two
  // strap holes and the stacking features in the key. Each rounded top corner
  // trims r²·(tan(θ/2) − θ/2) from the trapezoid, θ being the turn at that
  // corner. The edge chamfer takes a further sliver, within the tolerance.
  const turn = Math.PI / 2 - Math.atan(slope);
  const cornerLoss = params.headCornerRadius ** 2 * (Math.tan(turn / 2) - turn / 2);
  const profileArea =
    ((params.headBase + params.headTop) / 2) * params.headHeight - 2 * cornerLoss;

  const expected = {
    volume:
      keySectionArea(plug) * params.insertDepth +
      (profileArea - 2 * Math.PI * holeR ** 2) * thickness +
      keyStackingDelta,
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

  return { model, expected, webBetweenHoles, wallToEnd, wallAbove, wallBelow };
}

const standard = design();

export default function tieDownBlock(): ValidSolid {
  return standard.model();
}

export const { expected, webBetweenHoles, wallToEnd, wallAbove, wallBelow } = standard;
