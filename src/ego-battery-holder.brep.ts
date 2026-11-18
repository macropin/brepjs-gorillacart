/**
 * EGO battery holder.
 *
 * Carries an EGO POWER+ 56V battery on the rim. The key bar drops into a rim
 * cutout. Above the rim, a base flares out at 45° to carry a pair of upright
 * rails, the same T-section that EGO wall mounts use. The battery slides down
 * onto the rails from above and hangs from their top end, as it would on a
 * garage wall.
 *
 * EGO publishes the pack's outside size but not its rail interface, so the
 * rail section follows three published wall mounts, measured from their STLs:
 * Ego_Battery_Holder.stl (Printables model 81326), "ego battery support with
 * angle.stl", and 56v_Battery_Holder_v2.stl. The first two agree to the
 * millimetre, and this holder takes their numbers. See
 * docs/ego-battery-holder.md for the comparison.
 *
 * The rails face +X. The key is symmetric, so the holder drops into a cutout
 * either way round: rails out to hang the battery outside the cart, or in.
 *
 * The key carries the stacking bolt holes (./bolt.ts), counterbored on the
 * rails' side, so the holder can bolt to a side extension post instead, rails
 * out.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it. The rim is at z = insertDepth.
 */
import { cut, fuse, Sketcher, unwrap, type ValidSolid } from 'brepjs';

import { keyBoltHoles, keyBoltVolume } from './bolt.js';
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
   * Rail section, across both rails (Y) and out from the back (X). The battery
   * face rests on the flanges' front faces. Its channel's lips wrap round the
   * flange tips and hook in behind them, against the neck.
   */
  flangeWidth: 92, // tip to tip
  flangeThickness: 8,
  neckWidth: 83, // between the lip clearances behind the flanges

  /** Channel down the middle of the rails' front, clear of the battery's centre ridge. */
  recessWidth: 56,
  recessDepth: 10, // below the battery face

  /** Rails, from the top of the base to their top end, lead-in included. */
  railLength: 102.5,

  /** 45° lead-in that takes each rail's top corner in, to guide the channel on. */
  leadIn: 10,

  /** Breaks the section's outside corners, running the length of the rails. */
  edgeChamfer: 1,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const rim = params.insertDepth; // 63.5

/** The rail section is as deep (X) as the key, flush with it front and back. */
const back = -plug.x / 2; // -9.6
const face = plug.x / 2; // 9.6, where the battery face rests
const underFlange = face - params.flangeThickness; // 1.6
const recessFloor = face - params.recessDepth; // -0.4

const flangeHalf = params.flangeWidth / 2; // 46
const neckHalf = params.neckWidth / 2; // 41.5
const recessHalf = params.recessWidth / 2; // 28

/** Clear depth behind each flange for the battery's lips, open at the back. */
export const lipClearance = underFlange - back; // 11.2

/** The base flares at 45° from the key's length along the rim to the rails' full width. */
const baseHeight = flangeHalf - plug.y / 2; // 20.5
const railBottom = rim + baseHeight; // 84

/** Overall height: 84 + 102.5 = 186.5. */
const top = railBottom + params.railLength;

/** Where the lead-in meets the top face. */
const leadInStart = flangeHalf - params.leadIn; // 36

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** The rail section in XY, chamfered round its outside corners. */
function section(): [number, number][] {
  const c = params.edgeChamfer;
  // One side (+Y), from the back face's centreline out to the recess edge.
  const half: [number, number][] = [
    [back, neckHalf - c],
    [back + c, neckHalf],
    [underFlange, neckHalf],
    [underFlange, flangeHalf - c],
    [underFlange + c, flangeHalf],
    [face - c, flangeHalf],
    [face, flangeHalf - c],
    [face, recessHalf + c],
    [face - c, recessHalf],
    [recessFloor, recessHalf],
  ];
  const mirrored = half.map(([x, y]): [number, number] => [x, -y]).reverse();
  return [...half, ...mirrored];
}

export default function egoBatteryHolder(): ValidSolid {
  // The base, seen from the front: a trapezoid from the key's length at the
  // rim to the rails' width, extruded across the rim from back to face.
  const base = new Sketcher('YZ', back)
    .movePointerTo([-plug.y / 2, rim])
    .lineTo([plug.y / 2, rim])
    .lineTo([flangeHalf, railBottom])
    .lineTo([-flangeHalf, railBottom])
    .close()
    .extrude(plug.x);

  // The rails: the section extruded straight up from the base.
  const [first, ...rest] = section();
  let sketch = new Sketcher('XY', railBottom).movePointerTo(first!);
  for (const p of rest) sketch = sketch.lineTo(p);
  let rails = single(sketch.close().extrude(params.railLength));

  // The lead-in: a 45° cut across each top corner, through the full depth.
  for (const side of [1, -1]) {
    const wedge = new Sketcher('YZ', back - OVER)
      .movePointerTo([side * (leadInStart - OVER), top + OVER])
      .lineTo([side * (flangeHalf + OVER), top + OVER])
      .lineTo([side * (flangeHalf + OVER), top - params.leadIn - OVER])
      .close()
      .extrude(plug.x + 2 * OVER);
    rails = single(unwrap(cut(rails, single(wedge))));
  }

  const bar = single(unwrap(fuse(key(rim), single(base))));
  return keyBoltHoles(single(unwrap(fuse(bar, rails))));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// The section's depth in X across one half, out from the centreline: pieces
// [y0, y1] over which it runs linearly from d0 to d1. Worked from the
// parameters rather than the drawn outline.
const c = params.edgeChamfer;
const full = face - back; // 19.2
const t = params.flangeThickness;
const pieces: [number, number, number, number][] = [
  [0, recessHalf, recessFloor - back, recessFloor - back], // behind the recess
  [recessHalf, recessHalf + c, full - c, full], // recess-edge chamfer
  [recessHalf + c, neckHalf - c, full, full], // either side of the recess
  [neckHalf - c, neckHalf, full, full - c], // back-corner chamfer
  [neckHalf, flangeHalf - c, t, t], // flange
  [flangeHalf - c, flangeHalf, t, t - 2 * c], // tip chamfers, front and back
];

/**
 * ∫ depth(y)·(y − a)^n dy for y ≥ a, by Simpson's rule on each piece: exact,
 * since the integrand is at most quadratic on each.
 */
function moment(a: number, n: 0 | 1): number {
  let sum = 0;
  for (const [y0, y1, d0, d1] of pieces) {
    if (y1 <= a) continue;
    const p = Math.max(y0, a);
    const f = (y: number) => (d0 + ((d1 - d0) * (y - y0)) / (y1 - y0)) * (y - a) ** n;
    sum += ((y1 - p) / 6) * (f(p) + 4 * f((p + y1) / 2) + f(y1));
  }
  return sum;
}

const sectionArea = 2 * moment(0, 0);

// Each lead-in takes, at t below the top, the section beyond y = 36 + t: the
// first moment of the section beyond 36, about 36.
const leadInVolume = moment(leadInStart, 1);

const baseVolume = ((plug.y + params.flangeWidth) / 2) * baseHeight * plug.x;

export const expected = {
  volume:
    keySectionArea * rim +
    baseVolume +
    sectionArea * params.railLength -
    2 * leadInVolume -
    keyBoltVolume,
  bounds: {
    xMin: back,
    xMax: face,
    yMin: -flangeHalf,
    yMax: flangeHalf,
    zMin: 0,
    zMax: top,
  },
  tolerancePct: 0.1,
};
