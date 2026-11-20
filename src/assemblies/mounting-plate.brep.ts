/**
 * The mounting plate as fitted: a pair in neighbouring cutouts of the right
 * long side, hanging outside the rim, standing on the schematic cart. For
 * rendering only.
 *
 * Frame as in ./cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import mountingPlate from '../mounting-plate.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';

export default function mountingPlateScene(): Compound {
  const plate = mountingPlate();
  return stage([...cartBodies(), ...[1, 2].map((k) => onRim(plate, RIGHT, sideX(k), -half))]);
}
