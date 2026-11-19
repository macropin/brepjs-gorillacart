/**
 * Stacking accessories on a side extension post: the bolt pattern, and the
 * registration that lines the parts up independently of the bolts.
 *
 * With the side extension kit fitted, every cutout holds a post, so an
 * accessory can't drop into one. Instead it bolts flat to the outside face of
 * a post through two M5 bolts in its key, and a second accessory can bolt on
 * outside the first through the same holes with longer bolts.
 *
 * Bolts. The holes run across the rim (X), on the key's centreline (y = 0),
 * one above the other. Two bolts rather than one, so the accessory can't turn
 * about either of them.
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
 * Registration. A shallow rectangular boss with 45° flanks, around both bolt
 * holes, locates each joint along the rim, up and down, and in rotation, so
 * the parts sit in line whatever the bolts' clearance, and the bolts only
 * clamp. The flanks centre the parts as they're pressed together, and print
 * without support in any orientation.
 *
 * - The post carries the boss on its outside face. Above the rim it is free to
 *   stand proud.
 * - A key has to fit the cart's cutout, so it can't carry a boss. Instead it
 *   has a matching pocket in each broad face: the inside face's takes the
 *   post's boss.
 * - Between two keys, the stack locator, a separate printed part, is the boss
 *   for both: two bosses back to back, sitting in the pockets of both keys. It
 *   has the bolt holes through it, so the bolts keep it in place as the stack
 *   goes together.
 *
 * The pocket is the boss grown by the fit tolerance, 0.15 mm clear on each
 * flank, and as much deeper, so the faces meet before the boss bottoms out.
 *
 * The holes and counterbores are teardrops pointing up (+Z), and the nut
 * pocket has flats top and bottom, so a part printed standing needs no
 * support in them.
 *
 * Units and axes as in ./key.ts: X across the rim, Y along it, Z up.
 */
import { cut, fuse, Sketcher, unwrap, type ValidSolid } from 'brepjs';

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

export const registration = {
  /**
   * The boss at its base: across the bolt line (Y) and along it (Z). Big
   * enough that a key's pockets take the bolt holes and the head counterbore
   * whole, so the pocket and the counterbore stack as plain steps.
   */
  width: 18,
  length: 52,

  /** How far it stands proud, at 45° all round. */
  height: 3,

  /** Its centre above the bottom of an accessory's key: midway between the bolts. */
  centre: 30,
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

const { width: W, length: L, height: H, centre: C } = registration;

/** The pocket in a key's face: the boss grown by the fit tolerance across and in depth. */
const pocketW = W + cart.fitTolerance;
const pocketL = L + cart.fitTolerance;
const pocketDepth = H + cart.fitTolerance;

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/**
 * The pocket narrows 1 mm per mm of depth. It still holds the head counterbore
 * whole at its floor, and the bolt holes, so the volumes below hold.
 */
const holeExtents = bolt.heights.map((z) => z - C);
const fits = (r: number, up: number) =>
  pocketW / 2 - pocketDepth >= r &&
  holeExtents.every((dz) => pocketL / 2 - pocketDepth >= Math.max(r - dz, dz + up));
if (!fits(headR, headR * Math.SQRT2) || bolt.headDepth < pocketDepth) {
  throw new Error('registration pocket must contain the head counterbore');
}

/**
 * Section area of a teardrop of radius `r`: the circle, plus the square kite
 * between its two 45° tangents and the centre, less the quarter circle inside
 * that kite.
 */
const teardropArea = (r: number) => r ** 2 * (1 + (3 * Math.PI) / 4);

/** Section area of a regular hexagon `s` across flats. */
const hexArea = (s: number) => (Math.sqrt(3) / 2) * s ** 2;

/**
 * Volume of a rectangular frustum with 45° flanks, `w` × `l` at its base and
 * `h` tall. Its section shrinks by 2 mm per mm in each direction, so its area
 * is quadratic in height and the prismoidal formula is exact.
 */
const frustumVolume = (w: number, l: number, h: number) =>
  (h / 6) * (w * l + 4 * (w - h) * (l - h) + (w - 2 * h) * (l - 2 * h));

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

/** A `w` × `l` rectangle on the plane x = `x`, centred at y = 0 and height `z`. */
function rectangle(w: number, l: number, x: number, z: number) {
  return new Sketcher('YZ', x)
    .movePointerTo([-w / 2, z - l / 2])
    .lineTo([w / 2, z - l / 2])
    .lineTo([w / 2, z + l / 2])
    .lineTo([-w / 2, z + l / 2])
    .close();
}

/**
 * A rectangular frustum with 45° flanks, `w` × `l` on the plane x = `x0` and
 * centred at height `z`, rising `h` along X toward `dir`.
 */
function frustum(w: number, l: number, h: number, x0: number, z: number, dir: 1 | -1): ValidSolid {
  const base = rectangle(w, l, x0, z);
  const top = rectangle(w - 2 * h, l - 2 * h, x0 + dir * h, z);
  return single(base.loftWith(top, { ruled: true }));
}

function cutAll(part: ValidSolid, tools: ValidSolid[]): ValidSolid {
  for (const tool of tools) part = single(unwrap(cut(part, tool)));
  return part;
}

/**
 * Cuts the stacking features into an accessory's key, in the key's frame
 * (bottom of the key at z = 0): the bolt holes, a cap-head counterbore on the
 * +X face, and a registration pocket in each broad face.
 */
export function keyStackingCuts(part: ValidSolid): ValidSolid {
  // Each pocket starts OVER outside its face, grown to keep its 45° flanks.
  const pocket = (side: 1 | -1) =>
    frustum(
      pocketW + 2 * OVER,
      pocketL + 2 * OVER,
      pocketDepth + OVER,
      side * (half + OVER),
      C,
      side === 1 ? -1 : 1,
    );
  return cutAll(part, [
    ...bolt.heights.flatMap((z) => [
      teardrop(holeR, z, -half - OVER, half + OVER),
      teardrop(headR, z, half - bolt.headDepth, half + OVER),
    ]),
    pocket(1),
    pocket(-1),
  ]);
}

/**
 * Adds the stacking features to a post built upright, its rim at `rimZ`: the
 * registration boss on the outside (+X) face, the bolt holes through post and
 * boss, and a nut pocket on the inside face. Done before the post is leaned,
 * so they come out square to its faces.
 */
export function postStackingFeatures(part: ValidSolid, rimZ: number): ValidSolid {
  // The boss starts OVER inside the face, so it fuses into the post cleanly.
  const z = rimZ + bolt.standOff + C;
  const boss = frustum(W + 2 * OVER, L + 2 * OVER, H + OVER, half - OVER, z, 1);
  const bossed = single(unwrap(fuse(part, boss)));
  return cutAll(
    bossed,
    postHoleHeights.flatMap((h) => [
      teardrop(holeR, rimZ + h, -half - OVER, half + H + OVER),
      hexagon(bolt.nutAcrossFlats, rimZ + h, -half - OVER, -half + bolt.nutDepth),
    ]),
  );
}

/**
 * The stack locator, which registers one key on another: two bosses back to
 * back, about the plane x = 0 where the keys meet, centred at z = 0, with the
 * bolt holes through it.
 */
export function stackLocator(): ValidSolid {
  const both = single(
    rectangle(W - 2 * H, L - 2 * H, -H, 0).loftWith(
      [rectangle(W, L, 0, 0), rectangle(W - 2 * H, L - 2 * H, H, 0)],
      { ruled: true },
    ),
  );
  return cutAll(
    both,
    bolt.heights.map((z) => teardrop(holeR, z - C, -H - OVER, H + OVER)),
  );
}

// ---------------------------------------------------------------------------
// Volumes, for the parts' declared intent
// ---------------------------------------------------------------------------

// Each hole's teardrop lies inside its counterbore's and its nut pocket's
// section, and both lie inside the registration pocket's down to its floor.
// So going through a key from the +X face, the cuts take the pocket, then the
// counterbore below the pocket's floor, then the hole, then the -X face's
// pocket. Through the post, they take the nut pocket, then the hole, through
// the post and the boss.

/** The net change in volume from cutting the stacking features into a key (negative). */
export const keyStackingDelta = -(
  2 * frustumVolume(pocketW, pocketL, pocketDepth) +
  bolt.heights.length *
    (teardropArea(headR) * (bolt.headDepth - pocketDepth) +
      teardropArea(holeR) * (plug.x - bolt.headDepth - pocketDepth))
);

/** The net change in volume from adding the stacking features to a post. */
export const postStackingDelta =
  frustumVolume(W, L, H) -
  postHoleHeights.length *
    (hexArea(bolt.nutAcrossFlats) * bolt.nutDepth +
      teardropArea(holeR) * (plug.x - bolt.nutDepth + H));

/** The stack locator's volume: two bosses, less the bolt holes. */
export const stackLocatorVolume =
  2 * frustumVolume(W, L, H) - bolt.heights.length * teardropArea(holeR) * 2 * H;
