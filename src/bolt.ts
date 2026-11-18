/**
 * The bolt pattern that stacks accessories on a side extension post.
 *
 * With the side extension kit fitted, every cutout holds a post, so an
 * accessory can't drop into one. Instead it bolts flat to the outside face of
 * a post through two M5 bolts in its key, and a second accessory can bolt on
 * outside the first through the same holes with longer bolts.
 *
 * The holes run across the rim (X), on the key's centreline (y = 0), one above
 * the other. Two bolts rather than one, so the accessory can't turn about
 * either of them.
 *
 * - Accessories carry the pair in the key, low down, away from the rim where
 *   the key bends hardest in a cutout. A counterbore on the +X face takes the
 *   cap head. Fitted in a cutout as usual, both are hidden in the cutout.
 * - The post carries the same pair above the rim, `standOff` higher, so a key
 *   bolted to it stands just clear of the rim. A hex pocket on its inside face
 *   (-X) holds the nut, so nothing stands proud into the cart and the bolt is
 *   turned from outside.
 *
 * With the head and nut set into those depths, an M5 × 30 socket cap screw
 * clamps one accessory to a post and an M5 × 50 clamps two, each finishing
 * inside its nut pocket. See `boltLength`.
 *
 * The holes and counterbores are teardrops pointing up (+Z), and the nut
 * pocket has flats top and bottom, so a part printed standing needs no
 * support in them.
 *
 * Units and axes as in ./key.ts: X across the rim, Y along it, Z up.
 */
import { cut, Sketcher, unwrap, type ValidSolid } from 'brepjs';

import { cart, plug } from './cart.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const bolt = {
  /** Clearance hole for an M5 shank. */
  holeDiameter: 5.5,

  /**
   * Counterbore for an ISO 4762 M5 socket cap head, 8.5 mm across and 5 mm
   * tall, deep enough to set the head just below the face.
   */
  headDiameter: 9.5,
  headDepth: 5.5,

  /**
   * Pocket for an ISO 4032 M5 hex nut, 8 mm across flats and 4.7 mm thick.
   * Deeper than the nut, so the bolt's tip stays below the face.
   */
  nutAcrossFlats: 8 + cart.fitTolerance,
  nutThickness: 4.7,
  nutDepth: 8,

  /** Hole centres above the bottom of an accessory's key. */
  heights: [15, 45],

  /**
   * How far above the rim, measured along the post, a bolted-on key starts.
   * The rim reaches about 4 mm past the post's outside face, and the 6° lean
   * drops the key's bottom 1.5 mm toward the rim over that, so this leaves
   * about 3.5 mm clear.
   */
  standOff: 5,
} as const;

/** Hole centres above the rim on the post, measured along its axis: 20 and 50. */
export const postHoleHeights = bolt.heights.map((h) => bolt.standOff + h);

/**
 * The range of under-head lengths for the M5 bolt that clamps `layers`
 * accessories to a post. The shortest reaches through the nut, pulled down onto
 * the floor of its pocket; the longest ends flush with the post's inside face.
 * 1 -> [29.6, 32.9], taking an M5 × 30; 2 -> [48.8, 52.1], taking an M5 × 50.
 */
export function boltLength(layers: number): [number, number] {
  const longest = (layers + 1) * plug.x - bolt.headDepth;
  return [longest - bolt.nutDepth + bolt.nutThickness, longest];
}

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

const holeR = bolt.holeDiameter / 2;
const headR = bolt.headDiameter / 2;
const half = plug.x / 2;

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/**
 * Section area of a teardrop of radius `r`: the circle, plus the square kite
 * between its two 45° tangents and the centre, less the quarter circle inside
 * that kite.
 */
const teardropArea = (r: number) => r ** 2 * (1 + (3 * Math.PI) / 4);

/** Section area of a regular hexagon `s` across flats. */
const hexArea = (s: number) => (Math.sqrt(3) / 2) * s ** 2;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/**
 * A teardrop prism along X from `x0` to `x1`, centred at y = 0 and height `z`:
 * a circle of radius `r` with 45° flanks rising from it to a point above.
 */
function teardrop(r: number, z: number, x0: number, x1: number): ValidSolid {
  const t = r / Math.SQRT2;
  return single(
    new Sketcher('YZ', x0)
      .movePointerTo([t, z + t])
      .threePointsArcTo([-t, z + t], [0, z - r])
      .lineTo([0, z + r * Math.SQRT2])
      .close()
      .extrude(x1 - x0),
  );
}

/** A hexagonal prism along X from `x0` to `x1`, `s` across flats, flats top and bottom. */
function hexagon(s: number, z: number, x0: number, x1: number): ValidSolid {
  const c = s / Math.sqrt(3); // centre to corner
  const corners: [number, number][] = [
    [c, z],
    [c / 2, z + s / 2],
    [-c / 2, z + s / 2],
    [-c, z],
    [-c / 2, z - s / 2],
    [c / 2, z - s / 2],
  ];
  const [first, ...rest] = corners;
  let sketch = new Sketcher('YZ', x0).movePointerTo(first!);
  for (const p of rest) sketch = sketch.lineTo(p);
  return single(sketch.close().extrude(x1 - x0));
}

function cutAll(part: ValidSolid, tools: ValidSolid[]): ValidSolid {
  for (const tool of tools) part = single(unwrap(cut(part, tool)));
  return part;
}

/**
 * Cuts the pair into an accessory's key, in the key's frame (bottom of the key
 * at z = 0): through holes, and a cap-head counterbore on the +X face.
 */
export function keyBoltHoles(part: ValidSolid): ValidSolid {
  return cutAll(
    part,
    bolt.heights.flatMap((z) => [
      teardrop(holeR, z, -half - OVER, half + OVER),
      teardrop(headR, z, half - bolt.headDepth, half + OVER),
    ]),
  );
}

/**
 * Cuts the pair into a post built upright, its rim at `rimZ`: through holes,
 * and a nut pocket on the inside (-X) face. Cut before the post is leaned, so
 * the holes come out square to its faces.
 */
export function postBoltHoles(part: ValidSolid, rimZ: number): ValidSolid {
  return cutAll(
    part,
    postHoleHeights.flatMap((h) => [
      teardrop(holeR, rimZ + h, -half - OVER, half + OVER),
      hexagon(bolt.nutAcrossFlats, rimZ + h, -half - OVER, -half + bolt.nutDepth),
    ]),
  );
}

// ---------------------------------------------------------------------------
// Volumes, for the parts' declared intent
// ---------------------------------------------------------------------------

// Each hole's teardrop lies inside its counterbore's and its nut pocket's
// section, so the two cuts together take the larger section over the rebate's
// depth and the hole's over the rest of the key's 19.2 mm.

/** Material the pair takes out of an accessory's key. */
export const keyBoltVolume =
  bolt.heights.length *
  (teardropArea(headR) * bolt.headDepth + teardropArea(holeR) * (plug.x - bolt.headDepth));

/** Material the pair takes out of a post. */
export const postBoltVolume =
  postHoleHeights.length *
  (hexArea(bolt.nutAcrossFlats) * bolt.nutDepth + teardropArea(holeR) * (plug.x - bolt.nutDepth));
