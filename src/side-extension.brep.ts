/**
 * Side extension post.
 *
 * Raises the bucket walls past 200L. One post drops into each of the 8 rim
 * cutouts, all identical. The key bar goes straight down into the cutout; above
 * the rim the post leans outward so the extended walls carry on the bucket's
 * flare. A groove down each face that points along the rim takes the edge of a
 * side panel, which drops in from the top and spans to the next post.
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
  lean: 3,

  /** Panel groove across the face (X) and into it (Y). Centred on the face. */
  grooveWidth: 4,
  grooveDepth: 8,
} as const;

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

/** The post pivots about the rim line: the Y axis through x = 0 at rim height. */
const pivot: [number, number, number] = [0, 0, params.insertDepth];

/**
 * The leaning post is built upright, starting this far below the rim, then
 * tilted and trimmed flat at the rim. Enough to cover the 0.5mm the tilt lifts
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
  const groove = (side: 1 | -1) =>
    box(params.grooveWidth, params.grooveDepth + OVER, length + 2 * OVER, {
      centered: true,
      at: [
        0,
        side * (plug.y / 2 - params.grooveDepth / 2 + OVER / 2),
        params.insertDepth - BELOW + length / 2,
      ],
    });
  const grooved = single(
    unwrap(cut(single(unwrap(cut(upright, groove(1)))), groove(-1))),
  );

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

// The post's section (bar less both grooves) is symmetric about its axis in X,
// so the wedge the rim trim adds on one side equals the one it removes on the
// other. Its volume is therefore the section times `extension`, as if cut
// square to the axis.
const postSectionArea = keySectionArea - 2 * params.grooveWidth * params.grooveDepth;

const half = plug.x / 2;

export const expected = {
  volume: keySectionArea * params.insertDepth + postSectionArea * params.extension,
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
