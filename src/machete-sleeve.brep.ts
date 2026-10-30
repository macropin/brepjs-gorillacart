/**
 * Machete sleeve.
 *
 * A rounded rectangular bar. The bottom drops into a rim cutout; the part that
 * stands above the rim has a 3mm stadium slot running right through it, open
 * on both narrow faces, which the machete blade passes through. What is left
 * is two plates joined by solid ends.
 *
 * Units: millimetres. Z is up; the bar stands on the print bed at z = 0, which
 * is also the floor of the cutout once fitted. Centred on the origin in X/Y.
 * X is across the rim (cutout width), Y along it (cutout length).
 */
import {
  box,
  cut,
  cylinder,
  edgeFinder,
  fillet,
  fuse,
  getSolids,
  unwrap,
  validSolid,
  type AnyShape,
  type ValidSolid,
} from 'brepjs';

import { cart, plug } from './cart.js';

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

  /** Fillet on the four upright edges. */
  cornerRadius: 3,
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
  const blank = box(plug.x, plug.y, height, { centered: true, at: [0, 0, height / 2] });

  // Round the corners BEFORE cutting the slot: on a plain box `inDirection('Z')`
  // matches exactly the four upright edges.
  const bar = unwrap(fillet(blank, edgeFinder().inDirection('Z'), params.cornerRadius));

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

/**
 * OCCT hands back a Compound from a boolean even when the result is one body.
 * Collapse it to a single solid — and fail loudly if a boolean ever fragments
 * the part into several.
 */
function single(shape: AnyShape): ValidSolid {
  const solids = getSolids(shape);
  const [solid] = solids;
  if (solids.length !== 1 || !solid) {
    throw new Error(
      `expected exactly 1 solid, got ${solids.length} — a boolean fragmented the part`,
    );
  }
  return unwrap(validSolid(solid));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// The fillets and the slot remove material without moving the extents, so the
// bounding box is the plug section by the full height. The volume is the
// analytic figure: filleted bar minus the stadium slot across the full 51mm.
const r = params.slotWidth / 2;
const barArea = plug.x * plug.y - (4 - Math.PI) * params.cornerRadius ** 2;
const slotArea = params.slotWidth * params.slotSpan + Math.PI * r ** 2;

export const expected = {
  volume: barArea * height - slotArea * plug.y,
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
