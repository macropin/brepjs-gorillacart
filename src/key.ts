/**
 * The key: the bar every accessory is built on. Its bottom drops into a rim
 * cutout; what stands above the rim carries the accessory.
 *
 * Units: millimetres. Z is up; the bar stands on the print bed at z = 0, which
 * is also the floor of the cutout once fitted. Centred on the origin in X/Y.
 * X is across the rim (cutout width), Y along it (cutout length).
 */
import { box, chamfer, edgeFinder, unwrap, type ValidSolid } from 'brepjs';

import { plug, type Plug } from './cart.js';

/**
 * 45° chamfer on the four upright edges. Top and bottom faces stay flat. A
 * chamfer rather than a fillet so a key printed lying on its side, as the
 * tie-down block is, has a 45° slope at the bed instead of an overhanging
 * curve.
 */
export const keyChamfer = 1;

/** Cross-section area of the bar, chamfers included. */
export function keySectionArea(section: Plug = plug): number {
  return section.x * section.y - 2 * keyChamfer ** 2;
}

export function key(height: number, section: Plug = plug): ValidSolid {
  const blank = box(section.x, section.y, height, { centered: true, at: [0, 0, height / 2] });

  // On a plain box `inDirection('Z')` matches exactly the four upright edges, so
  // break them before anything else is cut or joined on.
  return unwrap(chamfer(blank, edgeFinder().inDirection('Z'), keyChamfer));
}
