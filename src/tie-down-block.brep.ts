/**
 * Tie-down block.
 *
 * Gives a load something to strap to. The key bar drops into a rim cutout; on
 * top sits a head that rests on the rim either side of the cutout and carries
 * two holes for a rope or hook to pass through, or one or two horizontal slits
 * for flat strap webbing. Fit as many as needed, one per cutout.
 *
 * It is held in by friction alone; pinning it would mean drilling the cart. In
 * use a strap through one hole, run down to the cart, pulls it into place.
 *
 * The idea follows the wagon cargo tie-down blocks sold for these carts: a
 * plug, a head wider than the pocket along the rim, and holes across it. The
 * geometry here is our own, built on the shared key.
 *
 * The head is no thicker than the key across the rim, so both broad faces are
 * flat and flush: the block prints lying on one of them with the holes or slits
 * upright, and needs no supports.
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
import { atLeast, DesignError, fitToleranceSpec, type Numeric, type Schema } from './params.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/** What the strap passes through, as the `openings` parameter numbers it. */
export const OPENINGS = { holes: 0, oneSlit: 1, twoSlits: 2 } as const;

const SLITS = [OPENINGS.oneSlit, OPENINGS.twoSlits];

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

  /**
   * What passes through the head, across the rim: two round holes, for rope or
   * a hook, or one or two horizontal slits, for flat strap webbing. Two slits
   * sit one above the other, so a strap can weave through them. See OPENINGS.
   */
  openings: OPENINGS.holes,

  /** Centre of the holes, or of the slits, above the rim. */
  openingHeight: 20,

  /** Strap holes. */
  holeDiameter: 20,
  holeSpacing: 28, // centre to centre, along the rim

  /** Strap slits: stadiums, long along the rim. */
  slitLength: 28, // end to end, along the rim
  slitHeight: 6,
  slitBar: 8, // solid between two slits

  /** Breaks every edge of the head's broad faces, hole and slit mouths included, so a strap has no sharp edge to wear on. */
  edgeChamfer: 1,

  /** Printed-fit slop, taken off the cutout's width and length. */
  fitTolerance: cart.fitTolerance,

  /** The stacking features (./stacking.ts): 1 to include each, 0 to leave it off. */
  boltHoles: stackingDefaults.boltHoles,
  registration: stackingDefaults.registration,
} as const;

export type Params = Numeric<typeof defaults>;

export const schema: Schema<Params> = {
  openings: {
    kind: 'choice',
    label: 'Strap openings',
    options: [
      { value: OPENINGS.holes, label: 'Two holes' },
      { value: OPENINGS.oneSlit, label: 'One slit' },
      { value: OPENINGS.twoSlits, label: 'Two slits' },
    ],
    help: 'Round holes for rope or a hook. Slits for flat strap webbing: two let a strap weave through.',
  },
  holeDiameter: {
    label: 'Strap hole diameter',
    unit: 'mm',
    min: 10,
    max: 24,
    step: 0.5,
    help: 'Both holes. Big enough for the hook or rope you tie down with.',
    when: { openings: [OPENINGS.holes] },
  },
  slitLength: {
    label: 'Slit length',
    unit: 'mm',
    min: 15,
    max: 50,
    step: 0.5,
    help: 'Along the rim. A little more than the strap is wide: 28 mm takes a 25 mm strap.',
    when: { openings: SLITS },
  },
  slitHeight: {
    label: 'Slit height',
    unit: 'mm',
    min: 3,
    max: 8,
    step: 0.5,
    help: 'Room to feed the webbing through.',
    when: { openings: SLITS },
  },
  ...keyStackingSchema,
  fitTolerance: fitToleranceSpec,
};

/** Least material left round the strap holes or slits. */
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
  const thickness = plug.x; // 19.2, flush with the key

  const holes = params.openings === OPENINGS.holes;
  if (!holes && !SLITS.includes(params.openings as (typeof SLITS)[number])) {
    throw new DesignError(`openings is ${params.openings}: 0 for holes, 1 or 2 for slits`);
  }
  if (!holes && params.slitLength <= params.slitHeight) {
    throw new DesignError('A slit must be longer than it is high');
  }

  const holeR = params.holeDiameter / 2;
  const holeZ = rim + params.openingHeight;

  const slitR = params.slitHeight / 2;
  const slitCount = params.openings === OPENINGS.twoSlits ? 2 : 1;

  /** How far each slit's centre sits above or below `openingHeight`. */
  const slitOffset = slitCount === 2 ? (params.slitHeight + params.slitBar) / 2 : 0;

  /** The slits' centres above the rim, from the bottom. */
  const slitHeights =
    slitCount === 2
      ? [params.openingHeight - slitOffset, params.openingHeight + slitOffset]
      : [params.openingHeight];

  /**
   * Material left around the openings: between them, out to the sloping ends
   * (measured square to the slope, where it is thinnest), above, and below to
   * the rim. `toEnd` measures from an end arc of radius `r` centred `y` along
   * the rim and `z` above it.
   */
  const slope = (params.headBase - params.headTop) / 2 / params.headHeight;
  const toEnd = (y: number, z: number, r: number) =>
    (params.headBase / 2 - y - slope * z) / Math.hypot(1, slope) - r;

  const walls = holes
    ? {
        between: params.holeSpacing - params.holeDiameter, // 8
        toEnd: toEnd(params.holeSpacing / 2, params.openingHeight, holeR), // 7.7
        above: params.headHeight - params.openingHeight - holeR, // 10
        below: params.openingHeight - holeR, // 10
      }
    : {
        // The top slit is the one nearest the sloping ends.
        between: slitCount === 2 ? params.slitBar : Infinity,
        toEnd: toEnd(params.slitLength / 2 - slitR, params.openingHeight + slitOffset, slitR),
        above: params.headHeight - params.openingHeight - slitOffset - slitR,
        below: params.openingHeight - slitOffset - slitR,
      };

  const what = holes ? 'strap holes' : slitCount === 2 ? 'strap slits' : 'strap slit';
  atLeast(`The web between the ${what}`, walls.between, MIN_WALL);
  atLeast(`The wall beyond the ends of the ${what}`, walls.toEnd, MIN_WALL);
  atLeast(`The wall above the ${what}`, walls.above, MIN_WALL);
  atLeast(`The wall below the ${what}`, walls.below, MIN_WALL);

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

    // A slit is a stadium on the YZ plane, its end arcs centred `a` either side
    // of the middle, cut right through across the rim.
    const a = params.slitLength / 2 - slitR;
    const slit = (z: number) =>
      single(
        new Sketcher('YZ', -thickness / 2 - OVER)
          .movePointerTo([-a, z - slitR])
          .lineTo([a, z - slitR])
          .threePointsArcTo([a, z + slitR], [a + slitR, z])
          .lineTo([-a, z + slitR])
          .threePointsArcTo([-a, z - slitR], [-a - slitR, z])
          .close()
          .extrude(thickness + 2 * OVER),
      );

    const openings = holes
      ? [hole(-params.holeSpacing / 2), hole(params.holeSpacing / 2)]
      : slitHeights.map((h) => slit(rim + h));
    let part = block;
    for (const opening of openings) part = single(unwrap(cut(part, opening)));

    if (params.edgeChamfer <= 0) return keyStackingCuts(part);

    // Every edge on the two broad faces above the rim: the head's outline and the
    // hole or slit mouths. The base of the head, where it meets the rim, is left
    // square so it sits flat.
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

  // Key below the rim plus the head's profile across its thickness, less the
  // strap holes or slits and the stacking features in the key. Each rounded top
  // corner trims r²·(tan(θ/2) − θ/2) from the trapezoid, θ being the turn at
  // that corner. A slit is a rectangle between its end centres plus a circle.
  // The edge chamfer takes a further sliver, within the tolerance.
  const turn = Math.PI / 2 - Math.atan(slope);
  const cornerLoss = params.headCornerRadius ** 2 * (Math.tan(turn / 2) - turn / 2);
  const profileArea =
    ((params.headBase + params.headTop) / 2) * params.headHeight - 2 * cornerLoss;
  const openingArea = holes
    ? 2 * Math.PI * holeR ** 2
    : slitCount * ((params.slitLength - params.slitHeight) * params.slitHeight + Math.PI * slitR ** 2);

  const expected = {
    volume:
      keySectionArea(plug) * params.insertDepth +
      (profileArea - openingArea) * thickness +
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

  return { model, expected, walls };
}

const standard = design();

export default function tieDownBlock(): ValidSolid {
  return standard.model();
}

export const { expected, walls } = standard;
