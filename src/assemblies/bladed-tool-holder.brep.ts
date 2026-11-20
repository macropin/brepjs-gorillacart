/**
 * The bladed tool holder as fitted: one holder in the middle cutout of the
 * right long side, standing on the schematic cart. For rendering only.
 *
 * Frame as in ./cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import bladedToolHolder from '../bladed-tool-holder.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';

export default function bladedToolHolderScene(): Compound {
  return stage([...cartBodies(), onRim(bladedToolHolder(), RIGHT, sideX(1), -half)]);
}
