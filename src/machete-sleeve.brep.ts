/**
 * Machete sleeve.
 *
 * Carries a machete on the rim. The key bar drops into a rim cutout; above the
 * rim a stadium slot runs right through it along the rim, open on both narrow
 * faces. The blade slides through edge down and is held by friction. What is
 * left is two plates joined by solid ends.
 *
 * The key carries the stacking bolt holes and registration pockets
 * (./stacking.ts), so the sleeve can bolt to a side extension post instead.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it. The rim is at z = insertDepth.
 */
import {
  box,
  chamfer,
  curvePointAt,
  cut,
  cylinder,
  edgeFinder,
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

  /** Thickness of the blade. The slot adds the fit tolerance. */
  bladeThickness: 3,

  /** Slot length between the centres of its two rounded ends. */
  slotSpan: 110,

  /**
   * Solid above and below the slot. The bar stands as far above the rim as the
   * slot and these two walls need: 130 mm as printed.
   */
  endWall: 8.35,

  /** Breaks the edges of both slot mouths, to guide the blade in. */
  slotChamfer: 1,

  /** Printed-fit slop, taken off the cutout's width and length and added to the slot. */
  fitTolerance: cart.fitTolerance,

  /** The stacking features (./stacking.ts): 1 to include each, 0 to leave it off. */
  boltHoles: stackingDefaults.boltHoles,
  registration: stackingDefaults.registration,
} as const;

export type Params = Numeric<typeof defaults>;

export const schema: Schema<Params> = {
  bladeThickness: {
    label: 'Blade thickness',
    unit: 'mm',
    min: 1.5,
    max: 8,
    step: 0.1,
    help: 'At its thickest, where it sits in the slot. The slot adds the fit tolerance.',
  },
  slotSpan: {
    label: 'Slot length',
    unit: 'mm',
    min: 40,
    max: 200,
    step: 1,
    help: 'Between the centres of its rounded ends. The widest blade, spine to edge, is this plus the slot width. The bar grows with it.',
  },
  ...keyStackingSchema,
  fitTolerance: fitToleranceSpec,
};

/** Least material left round the slot. */
const MIN_WALL = 4;

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function design(params: Params = defaults) {
  const plug = plugFor(params.fitTolerance);
  const { keyStackingCuts, keyStackingDelta } = stacking(params.fitTolerance, stackingFeatures(params));

  const rim = params.insertDepth; // 63.5

  const slotWidth = params.bladeThickness + params.fitTolerance; // 3.3
  const slotR = slotWidth / 2;

  /** Bar above the rim, the slot centred in it: 110 + 3.3 + 2 * 8.35 = 130. */
  const standHeight = params.slotSpan + slotWidth + 2 * params.endWall;

  /** Overall height: 63.5 + 130 = 193.5. */
  const height = rim + standHeight;
  const slotCentreZ = rim + standHeight / 2; // 128.5

  /** Solid left either side of the slot. */
  const sideWall = (plug.x - slotWidth) / 2; // 7.95

  atLeast('The wall either side of the slot', sideWall, MIN_WALL);
  atLeast('The wall above and below the slot', params.endWall, MIN_WALL);

  function model(): ValidSolid {
    // The slot: a stadium in XZ, cut through along Y as a box between the arc
    // centres and a cylinder at each end.
    const reach = plug.y + 2 * OVER;
    const end = (z: number) =>
      cylinder(slotR, reach, { at: [0, -reach / 2, z], axis: [0, 1, 0] });
    const middle = box(slotWidth, reach, params.slotSpan, {
      centered: true,
      at: [0, 0, slotCentreZ],
    });

    let part = key(height, plug);
    for (const tool of [
      middle,
      end(slotCentreZ - params.slotSpan / 2),
      end(slotCentreZ + params.slotSpan / 2),
    ]) {
      part = single(unwrap(cut(part, tool)));
    }

    if (params.slotChamfer <= 0) return keyStackingCuts(part);

    // The slot's outline on both narrow faces: everything on those faces within
    // the slot's width that isn't the top or bottom edge of the bar.
    const onSlotMouth = (edge: Edge) => {
      const [x, y, z] = curvePointAt(edge, 0.5);
      return (
        Math.abs(Math.abs(y) - plug.y / 2) < 1e-6 &&
        Math.abs(x) < slotR + 1e-6 &&
        z > rim &&
        z < height - 1e-6
      );
    };
    const chamfered = single(
      unwrap(chamfer(part, edgeFinder().when(onSlotMouth), params.slotChamfer)),
    );
    return keyStackingCuts(chamfered);
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  // The chamfers, the slot and the bolt holes remove material without moving the
  // extents, so the bounding box is the plug section by the full height. The
  // volume is the chamfered bar, less the stadium slot across the full 51mm, less
  // the chamfer round each mouth: a c²/2 triangle along each straight side, and
  // the same triangle swept round the two half-circle ends (Pappus, its centroid
  // c/3 out from the arc). Less the stacking features in the key.
  const slotArea = slotWidth * params.slotSpan + Math.PI * slotR ** 2;
  const c = params.slotChamfer;
  const chamferPerMouth =
    (c ** 2 / 2) * (2 * params.slotSpan + 2 * Math.PI * (slotR + c / 3));

  const expected = {
    volume:
      keySectionArea(plug) * height - slotArea * plug.y - 2 * chamferPerMouth + keyStackingDelta,
    bounds: {
      xMin: -plug.x / 2,
      xMax: plug.x / 2,
      yMin: -plug.y / 2,
      yMax: plug.y / 2,
      zMin: 0,
      zMax: height,
    },
    tolerancePct: 0.1,
  };

  return { model, expected, standHeight, sideWall };
}

const standard = design();

export default function macheteSleeve(): ValidSolid {
  return standard.model();
}

export const { expected, standHeight, sideWall } = standard;
