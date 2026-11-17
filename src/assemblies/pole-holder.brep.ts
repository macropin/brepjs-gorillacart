/**
 * The pole tool holder as fitted: a pair in neighbouring cutouts of the right
 * long side, so a tool pole clips in along the rim across both. Standing on
 * the schematic cart. For rendering only.
 *
 * Frame as in ./cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import poleHolder from '../pole-holder.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';

export default function poleHolderScene(): Compound {
  const holder = poleHolder();
  return stage([...cartBodies(), ...[1, 2].map((k) => onRim(holder, RIGHT, sideX(k), -half))]);
}
