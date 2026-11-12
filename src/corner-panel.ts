/**
 * Corner panel, shared by the left and right parts.
 *
 * Closes a handle-end corner of the cart: an L-shaped panel that slides into the
 * groove of the long-side post nearest the handle end with one leg, and into
 * the groove of the handle-end post on that side with the other. Between the
 * legs it follows the rim's own corner: a round, a flat, and a second round.
 *
 * Each leg leans 6° outward to sit in its posts' grooves, and the flat leans
 * the same way, so the rounds are slices of cones, flaring like the corners of
 * the bucket itself. Both legs stay the same length top to bottom, so their
 * ends sit square in the grooves.
 *
 * The corner is not square — the handle-end post sits nearer the corner than
 * the long-side post does — so the left and right corners are mirror images.
 * This module builds the left one; corner-panel-right mirrors it.
 *
 * Modelled as fitted and as printed, standing on its bottom edge. Z is up from
 * the rim (the groove floors) at z = 0. The origin is where the two legs' centre
 * planes cross at the bottom. Leg A runs along +X to the long-side post and
 * leans toward +Y; leg B runs along -Y to the handle-end post and leans toward
 * -X. The outside of the bend faces -X/+Y. Standing at the handle end facing
 * the tub, +X points away from you and +Y to your left.
 */
import { Sketcher, type Sketch, type ValidSolid } from 'brepjs';

import { cart, corner, plug } from './cart.js';
import { params as post } from './side-extension.brep.js';
import { thickness } from './side-panel.brep.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * The bend, on the panel's centreline at the bottom. Traced from the inside
 * edge of the rim in Gorilla's top-down product photo, then moved 17mm out to
 * the line through the cutouts, where the panel stands (see the README).
 */
export const params = {
  /** Height up the panel, matching the posts and side panels. */
  height: post.extension,

  /**
   * Where the flat meets each leg's line, measured from the origin: along leg A
   * (the long side) and along leg B (the handle end). The flat runs about 64.5°
   * from the long side.
   */
  flatOnSide: 43,
  flatOnEnd: 90,

  /** Round between the flat and leg A (the long side). */
  sideRadius: 63,

  /** Round between leg B (the handle end) and the flat. */
  endRadius: 51,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

type Vec = [number, number];

const rad = (post.lean * Math.PI) / 180;

/** Vertical height, and how far each leg has leaned out by the top. */
const rise = params.height * Math.cos(rad); // 149.18
const lean = params.height * Math.sin(rad); // 15.68

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
const endA = corner.along - toGrooveFloor - cart.fitTolerance / 2; // 122.05
const endB = corner.across - toGrooveFloor - cart.fitTolerance / 2; // 144.5

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];
const unit = (a: Vec): Vec => {
  const l = Math.hypot(a[0], a[1]);
  return [a[0] / l, a[1] / l];
};
const along = (p: Vec, n: Vec, d: number): Vec => [p[0] + n[0] * d, p[1] + n[1] * d];

// The centreline's three straight lines, each as an outward unit normal `n`
// with the line at n·p = 0 for the legs and n·p = flatC for the flat. Offsetting
// the centreline outward by `o` moves each line out by `o` and grows each round
// by `o` about the same centre.
const nA: Vec = [0, 1]; // leg A, y = 0
const nB: Vec = [-1, 0]; // leg B, x = 0
const flatDir = unit([params.flatOnSide, params.flatOnEnd]); // leg B toward leg A
const nF: Vec = [-flatDir[1], flatDir[0]];
const flatC = dot(nF, [params.flatOnSide, 0]);

/** Centre of the round of radius `r` tangent to two lines, inside both. */
function roundCentre(n1: Vec, c1: number, n2: Vec, c2: number, r: number): Vec {
  const a = c1 - r;
  const b = c2 - r;
  const det = n1[0] * n2[1] - n1[1] * n2[0];
  return [(a * n2[1] - n1[1] * b) / det, (n1[0] * b - a * n2[0]) / det];
}

const sideCentre = roundCentre(nA, 0, nF, flatC, params.sideRadius);
const endCentre = roundCentre(nB, 0, nF, flatC, params.endRadius);

/** Straight runs left between the rounds and the leg ends, and along the flat. */
const runA = endA - sideCentre[0];
const runB = endB + endCentre[1];
const runFlat = dot(sideCentre, flatDir) - dot(endCentre, flatDir);

// The rounds must keep clear of each other along the flat, and finish before
// either leg reaches a post's face.
if (runFlat < 0) throw new Error('the two rounds overlap along the flat');
if (sideCentre[0] + halfWidth > corner.along - plug.y / 2) {
  throw new Error(`sideRadius ${params.sideRadius} runs the bend into the long-side post`);
}
if (-endCentre[1] + halfWidth > corner.across - plug.y / 2) {
  throw new Error(`endRadius ${params.endRadius} runs the bend into the handle-end post`);
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function cornerPanel(): ValidSolid {
  // Bottom and top sections share their topology edge for edge, so a ruled loft
  // joins straight to straight (planes) and arc to arc (cones).
  const bottom = section(0, 0);
  const top = section(rise, lean);
  return single(bottom.loftWith(top, { ruled: true }));
}

/**
 * The panel's horizontal section at height `z`, where every part of the
 * centreline has leaned out by `out`.
 */
function section(z: number, out: number): Sketch {
  const outer = out + halfWidth;
  const inner = out - halfWidth;

  // Points on the centreline offset by `o`: the feet of the round centres on
  // each line, and each round's midpoint.
  const at = (o: number) => ({
    a: along(sideCentre, nA, params.sideRadius + o),
    sideMid: along(sideCentre, unit([nA[0] + nF[0], nA[1] + nF[1]]), params.sideRadius + o),
    flatSide: along(sideCentre, nF, params.sideRadius + o),
    flatEnd: along(endCentre, nF, params.endRadius + o),
    endMid: along(endCentre, unit([nF[0] + nB[0], nF[1] + nB[1]]), params.endRadius + o),
    b: along(endCentre, nB, params.endRadius + o),
  });
  const o = at(outer);
  const i = at(inner);

  return new Sketcher('XY', z)
    .movePointerTo([endA, outer])
    .lineTo(o.a)
    .threePointsArcTo(o.flatSide, o.sideMid)
    .lineTo(o.flatEnd)
    .threePointsArcTo(o.b, o.endMid)
    .lineTo([-outer, -endB])
    .lineTo([-inner, -endB])
    .lineTo(i.b)
    .threePointsArcTo(i.flatEnd, i.endMid)
    .lineTo(i.flatSide)
    .threePointsArcTo(i.a, i.sideMid)
    .lineTo([endA, inner])
    .close();
}

// ---------------------------------------------------------------------------
// Declared intent
// ---------------------------------------------------------------------------

// Each horizontal section is a strip of constant width along the centreline:
// three straight runs that keep their length, plus two rounds whose radii grow
// linearly with height. Its volume is the width times the centreline length at
// mid-height.
const sideTurn = Math.acos(dot(nA, nF));
const endTurn = Math.acos(dot(nF, nB));
const centreline =
  runA +
  runB +
  runFlat +
  sideTurn * (params.sideRadius + lean / 2) +
  endTurn * (params.endRadius + lean / 2);

export const volume = 2 * halfWidth * centreline * rise;

/** Bounds of the left part; the right part is the same mirrored in Y. */
export const extent = {
  xMin: -lean - halfWidth,
  xMax: endA,
  yMin: -endB,
  yMax: lean + halfWidth,
  zMin: 0,
  zMax: rise,
};
