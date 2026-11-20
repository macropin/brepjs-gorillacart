/**
 * The tool battery holder as fitted: one holder in the middle cutout of the
 * right long side, rails facing out of the cart, standing on the schematic
 * cart. For rendering only.
 *
 * Frame as in ./cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import toolBatteryHolder from '../tool-battery-holder.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';

export default function toolBatteryHolderScene(): Compound {
  return stage([...cartBodies(), onRim(toolBatteryHolder(), RIGHT, sideX(1), -half)]);
}
