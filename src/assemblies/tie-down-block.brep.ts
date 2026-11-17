/**
 * The tie-down block as fitted: a pair in neighbouring cutouts of the right
 * long side, standing on the schematic cart. For rendering only.
 *
 * Frame as in ./cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import tieDownBlock from '../tie-down-block.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';

export default function tieDownBlockScene(): Compound {
  const block = tieDownBlock();
  return stage([...cartBodies(), ...[1, 2].map((k) => onRim(block, RIGHT, sideX(k), -half))]);
}
