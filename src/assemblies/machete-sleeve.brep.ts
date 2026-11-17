/**
 * The machete sleeve as fitted: one sleeve in the middle cutout of the right
 * long side, standing on the schematic cart. For rendering only.
 *
 * Frame as in ./cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import macheteSleeve from '../machete-sleeve.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';

export default function macheteSleeveScene(): Compound {
  return stage([...cartBodies(), onRim(macheteSleeve(), RIGHT, sideX(1), -half)]);
}
