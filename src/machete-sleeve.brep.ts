/**
 * Machete sleeve.
 *
 * The key bar, with a 3mm stadium slot running right through the part that
 * stands above the rim, open on both narrow faces, which the machete blade
 * passes through. What is left is two plates joined by solid ends.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it.
 */
import { box, cut, cylinder, fuse, unwrap, type ValidSolid } from 'brepjs';

import { cart, plug } from './cart.js';
import { key, keySectionArea } from './key.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** Slot width (X) — the blade thickness it accepts. */
  slotWidth: 3,

  /** Slot length between the centres of its two rounded ends. */
  slotSpan: 110,

  /**
   * Extra bar above the rim beyond `slotSpan`, split evenly either side of the
   * slot. With the fit tolerance also taken off the height (as the original
   * design does), this leaves 8.35mm of solid at each end of the slot.
   */
  headroom: 20,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** Overall height: 63.5 + 110 + 20 - 0.3 = 193.2. */
const height =
  params.insertDepth + params.slotSpan + params.headroom - cart.fitTolerance;

/** The slot is centred in the length of bar that stands above the rim. */
const slotCentreZ = params.insertDepth + (height - params.insertDepth) / 2; // 128.35

/** Solid left either side of the slot, and above / below it. */
export const sideWall = (plug.x - params.slotWidth) / 2; // 8.1
export const slotEndWall = (height - params.insertDepth - params.slotSpan - params.slotWidth) / 2; // 8.35

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function macheteSleeve(): ValidSolid {
  const bar = key(height);

  // The slot: a stadium in XZ, extruded through along Y. Built as a box between
  // the arc centres plus a cylinder at each end.
  const r = params.slotWidth / 2;
  const reach = plug.y + 2 * OVER;
  const end = (z: number) =>
    cylinder(r, reach, { at: [0, -reach / 2, z], axis: [0, 1, 0] });
  const middle = box(params.slotWidth, reach, params.slotSpan, {
    centered: true,
    at: [0, 0, slotCentreZ],
  });
  const slot = single(
    unwrap(
      fuse(
        single(unwrap(fuse(middle, end(slotCentreZ - params.slotSpan / 2)))),
        end(slotCentreZ + params.slotSpan / 2),
      ),
    ),
  );

  return single(unwrap(cut(bar, slot)));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// The fillets and the slot remove material without moving the extents, so the
// bounding box is the plug section by the full height. The volume is the
// analytic figure: filleted bar minus the stadium slot across the full 51mm.
const r = params.slotWidth / 2;
const slotArea = params.slotWidth * params.slotSpan + Math.PI * r ** 2;

export const expected = {
  volume: keySectionArea * height - slotArea * plug.y,
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
