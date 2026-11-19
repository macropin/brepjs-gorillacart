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
 * Like the side panel, each leg end carries a lip on its inside face that drops
 * into the recess at the bottom of the post's groove and stops the leg pulling
 * out along its length.
 *
 * Also like the side panel, the bottom edge follows the rim: level with the
 * groove floors along each leg's landing beside its post, and dropped to the
 * lower rim everywhere between, round the bend.
 *
 * The corner is not square — the handle-end post sits nearer the corner than
 * the long-side post does — so the left and right corners are mirror images.
 * This module builds the left one; corner-panel-right mirrors it.
 *
 * Modelled as fitted, standing on its bottom edge. Print it upside down, on its
 * top edge, which is flat: the bottom edge steps, and the undropped leg ends
 * would start in mid-air. Z is up from the groove floors at z = 0; the dropped
 * bottom edge reaches below. The origin is where the lines through
 * the two posts' cutout centres cross; the posts' grooves sit a little outside
 * those lines, so the legs' centre planes do too. Leg A runs along +X to the
 * long-side post and leans toward +Y; leg B runs along -Y to the handle-end
 * post and leans toward -X. The outside of the bend faces -X/+Y. Standing at
 * the handle end facing the tub, +X points away from you and +Y to your left.
 */
import { box, cut, Sketcher, unwrap, type Sketch, type ValidSolid } from 'brepjs';

import { cart, corner } from './cart.js';
import { DesignError } from './params.js';
import { defaults, design as postDesign, type KitParams } from './side-extension.brep.js';
import { design as panelDesign } from './side-panel.brep.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/**
 * The bend, on the lines through the cutouts at the bottom. Traced from the
 * inside edge of the rim in Gorilla's top-down product photo, then moved 17mm
 * out to those lines. The panel's centreline runs a further
 * 2mm out, with the posts' grooves, and its rounds grow to match. The rest of
 * the panel takes the kit's parameters (./side-extension.brep.ts): its height
 * is the posts' extension.
 */
export const bend = {
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
// The bend
// ---------------------------------------------------------------------------

type Vec = [number, number];

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
const flatDir = unit([bend.flatOnSide, bend.flatOnEnd]); // leg B toward leg A
const nF: Vec = [-flatDir[1], flatDir[0]];
const flatC = dot(nF, [bend.flatOnSide, 0]);

/** Centre of the round of radius `r` tangent to two lines, inside both. */
function roundCentre(n1: Vec, c1: number, n2: Vec, c2: number, r: number): Vec {
  const a = c1 - r;
  const b = c2 - r;
  const det = n1[0] * n2[1] - n1[1] * n2[0];
  return [(a * n2[1] - n1[1] * b) / det, (n1[0] * b - a * n2[0]) / det];
}

const sideCentre = roundCentre(nA, 0, nF, flatC, bend.sideRadius);
const endCentre = roundCentre(nB, 0, nF, flatC, bend.endRadius);

/** The straight run along the flat, between the rounds. */
const runFlat = dot(sideCentre, flatDir) - dot(endCentre, flatDir);

// The rounds must keep clear of each other along the flat.
if (runFlat < 0) throw new Error('the two rounds overlap along the flat');

/**
 * Points on the bend, `o` outside the lines through the cutouts (negative for
 * inside): where each round meets its leg and the flat, and each round's
 * midpoint. In this module's frame, running from leg A round to leg B. Also
 * traces the rim's own corner for the cart in the assembly renders.
 */
export function bendPoints(o: number) {
  return {
    a: along(sideCentre, nA, bend.sideRadius + o),
    sideMid: along(sideCentre, unit([nA[0] + nF[0], nA[1] + nF[1]]), bend.sideRadius + o),
    flatSide: along(sideCentre, nF, bend.sideRadius + o),
    flatEnd: along(endCentre, nF, bend.endRadius + o),
    endMid: along(endCentre, unit([nF[0] + nB[0], nF[1] + nB[1]]), bend.endRadius + o),
    b: along(endCentre, nB, bend.endRadius + o),
  };
}

/** Overshoot so trims clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** The left corner panel for the kit's parameters, its volume and its bounds. */
export function cornerPanelDesign(params: KitParams = defaults) {
  const { plug, grooveOffset } = postDesign(params);
  const { thickness, lipLength, lipStandoff, dropDepth } = panelDesign(params);

  const rad = (params.lean * Math.PI) / 180;

  /** Vertical height, and how far each leg has leaned out by the top. */
  const rise = params.extension * Math.cos(rad); // 149.18
  const lean = params.extension * Math.sin(rad); // 15.68

  /**
   * Half the panel's thickness measured horizontally. The legs lean, so this is
   * a touch wider than half of `thickness`, which is measured square to the leg.
   */
  const halfWidth = thickness / Math.cos(rad) / 2;

  /**
   * The posts' grooves sit outside their axes, so at the rim each leg's centre
   * plane is this far out from its cutout line, measured horizontally.
   */
  const grooveOut = grooveOffset / Math.cos(rad); // 2.01

  /** The side panel's lip, its stand-off likewise measured horizontally. */
  const lipWidth = lipStandoff / Math.cos(rad);

  /** Post centre to its groove floor, along the rim. */
  const toGrooveFloor = plug.y / 2 - params.grooveDepth; // 17.5

  /**
   * Leg ends, from the corner: each stops short of its groove floor by half the
   * fit tolerance, as the side panel does at each end.
   */
  const endA = corner.along - toGrooveFloor - params.fitTolerance / 2; // 122.75
  const endB = corner.across - toGrooveFloor - params.fitTolerance / 2; // 145.0

  /**
   * How far from the corner each leg's bottom edge stays dropped: up to the
   * landing beside its post's cutout, less half the fit tolerance, so it is 0.15
   * clear of the landing as on the side panel. Each post's cutout runs along its
   * leg. The side panel's drop depth is taken vertically here.
   */
  const dropA =
    corner.along - cart.cutoutLength / 2 - cart.landingLength - params.fitTolerance / 2; // 94.6
  const dropB =
    corner.across - cart.cutoutLength / 2 - cart.landingLength - params.fitTolerance / 2; // 116.85

  /** How far the bottom edge has leaned in at the dropped depth, below the rim. */
  const dropIn = dropDepth * Math.tan(rad); // 0.16

  /** Half-width of each trim across its leg: clear of the leg and its lip. */
  const TRIM_REACH = plug.y / 2;

  /** Straight runs left between the rounds and the leg ends. */
  const runA = endA - sideCentre[0];
  const runB = endB + endCentre[1];

  // The rounds must finish before either leg reaches a post's face.
  if (sideCentre[0] + halfWidth > corner.along - plug.y / 2) {
    throw new DesignError(`sideRadius ${bend.sideRadius} runs the bend into the long-side post`);
  }
  if (-endCentre[1] + halfWidth > corner.across - plug.y / 2) {
    throw new DesignError(`endRadius ${bend.endRadius} runs the bend into the handle-end post`);
  }

  // The step up to each landing must land on a straight run, so the trims square
  // to the legs only ever meet a leg.
  if (dropA < sideCentre[0]) throw new DesignError('the long-side landing reaches into the bend');
  if (dropB < -endCentre[1]) throw new DesignError('the handle-end landing reaches into the bend');

  /**
   * The panel's horizontal section at height `z`, where every part of the
   * centreline has leaned out by `out`.
   */
  function section(z: number, out: number): Sketch {
    const outer = out + halfWidth;
    const inner = out - halfWidth;
    const o = bendPoints(outer);
    const i = bendPoints(inner);

    return new Sketcher('XY', z)
      .movePointerTo([endA, outer])
      .lineTo(o.a)
      .threePointsArcTo(o.flatSide, o.sideMid)
      .lineTo(o.flatEnd)
      .threePointsArcTo(o.b, o.endMid)
      .lineTo([-outer, -endB])
      .lineTo([-inner + lipWidth, -endB])
      .lineTo([-inner + lipWidth, -endB + lipLength])
      .lineTo([-inner, -endB + lipLength])
      .lineTo(i.b)
      .threePointsArcTo(i.flatEnd, i.endMid)
      .lineTo(i.flatSide)
      .threePointsArcTo(i.a, i.sideMid)
      .lineTo([endA - lipLength, inner])
      .lineTo([endA - lipLength, inner - lipWidth])
      .lineTo([endA, inner - lipWidth])
      .close();
  }

  function model(): ValidSolid {
    // Bottom and top sections share their topology edge for edge, so a ruled loft
    // joins straight to straight (planes) and arc to arc (cones). It starts at the
    // dropped bottom edge, carrying the lean on down below the rim.
    const bottom = section(-dropDepth, grooveOut - dropIn);
    const top = section(rise, grooveOut + lean);
    let panel = single(bottom.loftWith(top, { ruled: true }));

    // Trim each leg's end back up to the groove floor along its landing.
    const below = dropDepth + OVER;
    const landingA = box(endA + OVER - dropA, 2 * TRIM_REACH, below, {
      centered: true,
      at: [(dropA + endA + OVER) / 2, 0, -below / 2],
    });
    const landingB = box(2 * TRIM_REACH, endB + OVER - dropB, below, {
      centered: true,
      at: [0, -(dropB + endB + OVER) / 2, -below / 2],
    });
    for (const trim of [landingA, landingB]) {
      panel = single(unwrap(cut(panel, trim)));
    }
    return panel;
  }

  // -------------------------------------------------------------------------
  // Declared intent
  // -------------------------------------------------------------------------

  // Each horizontal section of the loft is a strip of constant width along the
  // centreline: three straight runs that keep their length, plus two rounds whose
  // radii grow linearly with height. Its volume is the width times the centreline
  // length at mid-height. The two lips add a constant rectangle each. The trims
  // then take the dropped depth off each leg's end: a straight strip from its
  // landing to its end, plus its lip.
  const sideTurn = Math.acos(dot(nA, nF));
  const endTurn = Math.acos(dot(nF, nB));
  const midOut = grooveOut + (lean - dropIn) / 2;
  const centreline =
    runA +
    runB +
    runFlat +
    sideTurn * (bend.sideRadius + midOut) +
    endTurn * (bend.endRadius + midOut);

  const lofted = (2 * halfWidth * centreline + 2 * lipLength * lipWidth) * (rise + dropDepth);
  const trimmed =
    (2 * halfWidth * (endA - dropA + endB - dropB) + 2 * lipLength * lipWidth) * dropDepth;

  const volume = lofted - trimmed;

  /** Bounds of the left part; the right part is the same mirrored in Y. */
  const extent = {
    xMin: -grooveOut - lean - halfWidth,
    xMax: endA,
    yMin: -endB,
    yMax: grooveOut + lean + halfWidth,
    zMin: -dropDepth,
    zMax: rise,
  };

  return { model, volume, extent };
}
