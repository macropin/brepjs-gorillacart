/**
 * The key: the rounded bar every accessory is built on. Its bottom drops into a
 * rim cutout; what stands above the rim carries the accessory.
 *
 * Units: millimetres. Z is up; the bar stands on the print bed at z = 0, which
 * is also the floor of the cutout once fitted. Centred on the origin in X/Y.
 * X is across the rim (cutout width), Y along it (cutout length).
 */
import { box, edgeFinder, fillet, unwrap, type ValidSolid } from 'brepjs';

import { plug } from './cart.js';

/** Fillet on the four upright edges. Top and bottom faces stay flat. */
export const keyCornerRadius = 3;

/** Cross-section area of the bar, fillets included. */
export const keySectionArea = plug.x * plug.y - (4 - Math.PI) * keyCornerRadius ** 2;

export function key(height: number): ValidSolid {
  const blank = box(plug.x, plug.y, height, { centered: true, at: [0, 0, height / 2] });

  // On a plain box `inDirection('Z')` matches exactly the four upright edges, so
  // round them before anything else is cut or joined on.
  return unwrap(fillet(blank, edgeFinder().inDirection('Z'), keyCornerRadius));
}
