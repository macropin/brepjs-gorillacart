/**
 * Machete sleeve.
 *
 * Carries a machete on the rim. The key bar drops into a rim cutout; above the
 * rim a stadium slot runs right through it along the rim, open on both narrow
 * faces. The blade slides through edge down and is held by friction. What is
 * left is two plates joined by solid ends.
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

import { cart, plug } from './cart.js';
import { key, keySectionArea } from './key.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** Bar above the rim. The slot is centred in it. */
  standHeight: 130,

  /** Thickness of the blade. The slot adds the fit tolerance. */
  bladeThickness: 3,

  /** Slot length between the centres of its two rounded ends. */
  slotSpan: 110,

  /** Breaks the edges of both slot mouths, to guide the blade in. */
  slotChamfer: 1,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const rim = params.insertDepth; // 63.5

/** Overall height: 63.5 + 130 = 193.5. */
const height = rim + params.standHeight;

const slotWidth = params.bladeThickness + cart.fitTolerance; // 3.3
const slotR = slotWidth / 2;
const slotCentreZ = rim + params.standHeight / 2; // 128.5

/** Solid left either side of the slot, and above / below it. */
export const sideWall = (plug.x - slotWidth) / 2; // 7.95
export const endWall = (params.standHeight - params.slotSpan - slotWidth) / 2; // 8.35

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function macheteSleeve(): ValidSolid {
  // The slot: a stadium in XZ, cut through along Y as a box between the arc
  // centres and a cylinder at each end.
  const reach = plug.y + 2 * OVER;
  const end = (z: number) =>
    cylinder(slotR, reach, { at: [0, -reach / 2, z], axis: [0, 1, 0] });
  const middle = box(slotWidth, reach, params.slotSpan, {
    centered: true,
    at: [0, 0, slotCentreZ],
  });

  let part = key(height);
  for (const tool of [
    middle,
    end(slotCentreZ - params.slotSpan / 2),
    end(slotCentreZ + params.slotSpan / 2),
  ]) {
    part = single(unwrap(cut(part, tool)));
  }

  if (params.slotChamfer <= 0) return part;

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
  return single(unwrap(chamfer(part, edgeFinder().when(onSlotMouth), params.slotChamfer)));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// The fillets and the slot remove material without moving the extents, so the
// bounding box is the plug section by the full height. The volume is the
// filleted bar, less the stadium slot across the full 51mm, less the chamfer
// round each mouth: a c²/2 triangle along each straight side, and the same
// triangle swept round the two half-circle ends (Pappus, its centroid c/3
// out from the arc).
const slotArea = slotWidth * params.slotSpan + Math.PI * slotR ** 2;
const c = params.slotChamfer;
const chamferPerMouth =
  (c ** 2 / 2) * (2 * params.slotSpan + 2 * Math.PI * (slotR + c / 3));

export const expected = {
  volume: keySectionArea * height - slotArea * plug.y - 2 * chamferPerMouth,
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
