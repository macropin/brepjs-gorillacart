/**
 * Side extension post.
 *
 * Raises the bucket walls past 200L. One post drops into each of the 8 rim
 * cutouts, all identical. The key bar goes straight down into the cutout; above
 * the rim the post leans outward so the extended walls carry on the bucket's
 * flare. A groove down each face that points along the rim takes the edge of a
 * side panel, which drops in from the top and spans to the next post.
 *
 * Each groove is L-shaped: at its bottom, a recess opens sideways into the wall
 * on the inside of the cart. The panel's end carries a matching lip, so once it
 * has slid down into place it can't pull out of the groove along its length.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it. The post leans toward +X, so fit it
 * with +X facing out of the cart.
 */
import { box, cut, fuse, rotate, translate, unwrap, type ValidSolid } from 'brepjs';

import { cart, plug } from './cart.js';
import { key, keySectionArea } from './key.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const params = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** Post length above the rim, measured along its leaning axis. */
  extension: 150,

  /** Outward lean of the post from vertical, in degrees. */
  lean: 6,

  /** Panel groove across the face (X) and into it (Y). */
  grooveWidth: 4,
  grooveDepth: 8,
} as const;

/**
 * The lip recess at the bottom of each groove, square in section: this far
 * along the groove from its floor, and this far sideways into the inside wall.
 * Half the groove depth, so the 4mm in front of it is left as the shoulder
 * that catches the panel's lip.
 */
export const lipSize = params.grooveDepth / 2;

/**
 * How far the groove's centre sits toward +X (the outside) of the post's axis.
 * Groove and recess together span 8mm across the post; offsetting the groove
 * by half the recess centres that span, leaving equal walls of
 * (19.2 - 4 - 4) / 2 = 5.6mm outside the groove and inside the recess.
 */
export const grooveOffset = lipSize / 2; // 2

/** Thinnest wall either side of the groove and recess. */
export const sideWall = (plug.x - params.grooveWidth - lipSize) / 2; // 5.6

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** The post pivots about the rim line: the Y axis through x = 0 at rim height. */
const pivot: [number, number, number] = [0, 0, params.insertDepth];

/**
 * The leaning post is built upright, starting this far below the rim, then
 * tilted and trimmed flat at the rim. Enough to cover the 1mm the tilt lifts
 * its bottom edge on the inner side.
 */
const BELOW = 2;

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

const rad = (params.lean * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export default function sideExtension(): ValidSolid {
  const insert = key(params.insertDepth);

  // The post, upright for now, from BELOW under the rim to its full length above.
  const length = BELOW + params.extension;
  const upright = translate(key(length), [0, 0, params.insertDepth - BELOW]);

  // A groove down each ±Y face, open at the top. It runs past the bottom of the
  // post too; once trimmed and joined, the insert's top face closes it off as a
  // floor at rim height.
  const zMid = params.insertDepth - BELOW + length / 2;
  const groove = (side: 1 | -1) =>
    box(params.grooveWidth, params.grooveDepth + OVER, length + 2 * OVER, {
      centered: true,
      at: [grooveOffset, side * (plug.y / 2 - params.grooveDepth / 2 + OVER / 2), zMid],
    });

  // The lip recess at the groove floor, opening sideways into the inside wall
  // (-X). It overlaps the groove by OVER so the two cuts join cleanly.
  const floorY = plug.y / 2 - params.grooveDepth; // 17.5
  const recess = (side: 1 | -1) =>
    box(lipSize + OVER, lipSize, length + 2 * OVER, {
      centered: true,
      at: [
        grooveOffset - (params.grooveWidth / 2 + (lipSize - OVER) / 2),
        side * (floorY + lipSize / 2),
        zMid,
      ],
    });

  let grooved = upright;
  for (const tool of [groove(1), groove(-1), recess(1), recess(-1)]) {
    grooved = single(unwrap(cut(grooved, tool)));
  }

  // Positive rotation about +Y swings the top toward +X.
  const leaning = rotate(grooved, params.lean, { at: pivot, axis: [0, 1, 0] });

  // Trim flat at the rim so the post sits square on the insert's top face.
  const reach = 4 * plug.y;
  const belowRim = box(reach, reach, params.insertDepth, {
    centered: true,
    at: [0, 0, params.insertDepth / 2],
  });
  const post = single(unwrap(cut(leaning, belowRim)));

  return single(unwrap(fuse(insert, post)));
}

// ---------------------------------------------------------------------------
// Declared intent — asserted by `brep verify --check`
// ---------------------------------------------------------------------------

// Cut square to its axis, the post would be its section times `extension`.
// The rim trim is tilted instead: it keeps local heights z ≥ x·tan(lean)
// measured from the pivot, so it takes off tan(lean) times the section's first
// moment about the axis. The bar is symmetric in X and contributes nothing; the
// section's moment is the opposite of what the grooves (centred at
// x = grooveOffset) and lip recesses (centred at grooveOffset - 4) take out.
const grooveArea = params.grooveWidth * params.grooveDepth;
const recessArea = lipSize * lipSize;
const recessX = grooveOffset - (params.grooveWidth + lipSize) / 2;
const postSectionArea = keySectionArea - 2 * grooveArea - 2 * recessArea;
const postSectionMoment = -(2 * grooveArea * grooveOffset + 2 * recessArea * recessX);

const half = plug.x / 2;

export const expected = {
  volume:
    keySectionArea * params.insertDepth +
    postSectionArea * params.extension -
    Math.tan(rad) * postSectionMoment,
  bounds: {
    // Inner face where the trim meets it, just outside the insert.
    xMin: -half / Math.cos(rad),
    // Outer top corner.
    xMax: params.extension * Math.sin(rad) + half * Math.cos(rad),
    yMin: -plug.y / 2,
    yMax: plug.y / 2,
    zMin: 0,
    // Inner top corner.
    zMax: params.insertDepth + params.extension * Math.cos(rad) + half * Math.sin(rad),
  },
  tolerancePct: 0.1,
};
