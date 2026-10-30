/**
 * Pole tool holder.
 *
 * The key bar with a U-shaped clip on its top face. The clip's side profile is
 * the convex hull of the bar's top edge and a circle around the pole, cut flat
 * a little above the pole centre so the opening is narrower than the bore and
 * the pole snaps in. It is extruded the full 51mm along Y, and the pole lies
 * along the rim.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it.
 */
import { cut, cylinder, draw, fuse, unwrap, type ValidSolid } from 'brepjs';

import { cart, plug } from './cart.js';
import { key, keySectionArea } from './key.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** Bar above the rim, under the clip. */
  standHeight: 50,

  /** Outside diameter of the tool pole. The bore adds the fit tolerance. */
  poleDiameter: 25.3,

  /** Clip wall around the bore, and the floor under it. */
  wall: 3,

  /**
   * Height of the flat top cut above the bore centre. Anything above zero
   * leaves the opening narrower than the bore, which is what retains the pole.
   */
  lipHeight: 4,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** Bar height: 63.5 + 50 - 0.3 = 113.2, the fit tolerance taken off as on the sleeve. */
const height = params.insertDepth + params.standHeight - cart.fitTolerance;

const boreR = (params.poleDiameter + cart.fitTolerance) / 2; // 12.8
const outerR = boreR + params.wall; // 15.8

/** In clip coordinates, z = 0 on the bar's top face. The outer circle sits on it. */
const centreZ = outerR; // 15.8
const cutZ = centreZ + params.lipHeight; // 19.8

/** Half the bar's top edge; the profile's side lines run from here. */
const halfBase = plug.x / 2; // 9.6

/**
 * Where the side line from the base corner meets the outer circle tangentially.
 * `beta` is the angle at the centre between the base corner and the circle's
 * bottom point; the tangent point sits the same angle the other side of it.
 */
const toCorner = Math.atan2(-centreZ, halfBase);
const beta = Math.acos(outerR / Math.hypot(halfBase, centreZ));
const tangent: [number, number] = [
  outerR * Math.cos(toCorner + beta),
  centreZ + outerR * Math.sin(toCorner + beta),
]; // (14.02, 8.52)

/** Half-widths of the outer edge and the bore at the top cut. */
const outerAtCut = Math.sqrt(outerR ** 2 - params.lipHeight ** 2); // 15.285
const boreAtCut = Math.sqrt(boreR ** 2 - params.lipHeight ** 2); // 12.159

/** Snap opening across the top, and the flat lip either side of it. */
export const opening = 2 * boreAtCut; // 24.32
export const lipWidth = outerAtCut - boreAtCut; // 3.13

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function poleHolder(): ValidSolid {
  const bar = key(height);

  // The clip's outer profile in XZ, already cut flat across the top. Each arc is
  // pinned by a point on the circle level with its centre, which lies between
  // the tangent point and the cut on either side.
  const profile = draw([-halfBase, 0])
    .lineTo([halfBase, 0])
    .lineTo(tangent)
    .threePointsArcTo([outerAtCut, cutZ], [outerR, centreZ])
    .lineTo([-outerAtCut, cutZ])
    .threePointsArcTo([-tangent[0], tangent[1]], [-outerR, centreZ])
    .close()
    .translate(0, height);

  // The XZ plane's normal is -Y, so start the sketch at +Y and extrude back
  // across the full length.
  const clip = single(profile.sketchOnPlane('XZ', [0, plug.y / 2, 0]).extrude(plug.y));

  const bore = cylinder(boreR, plug.y + 2 * OVER, {
    at: [0, -plug.y / 2 - OVER, height + centreZ],
    axis: [0, 1, 0],
  });

  return single(unwrap(cut(single(unwrap(fuse(bar, clip))), bore)));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

/** Area of a circle of radius `r` lying below a chord `d` above its centre. */
const belowChord = (r: number, d: number) =>
  Math.PI * r ** 2 - (r ** 2 * Math.acos(d / r) - d * Math.sqrt(r ** 2 - d ** 2));

// Clip profile: the outer circle below the cut, plus the sliver either side
// between the base, the side line and the circle (a kite of two right triangles
// less the sector they span), less the bore below the cut.
const clipArea =
  belowChord(outerR, params.lipHeight) +
  2 * (outerR * halfBase - outerR ** 2 * beta) -
  belowChord(boreR, params.lipHeight);

export const expected = {
  volume: keySectionArea * height + clipArea * plug.y,
  bounds: {
    xMin: -outerR,
    xMax: outerR,
    yMin: -plug.y / 2,
    yMax: plug.y / 2,
    zMin: 0,
    zMax: height + cutZ,
  },
  tolerancePct: 0.1,
};
