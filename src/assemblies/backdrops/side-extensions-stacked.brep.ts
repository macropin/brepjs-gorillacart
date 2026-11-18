/**
 * Backdrop for ../side-extensions-stacked.brep.ts: the side extension kit on
 * the cart, without the stacked accessories, so the render colours only the
 * stack. It carries the scene's framing specks, so the two have the same
 * bounding box and render in register. For rendering only.
 *
 * Frame as in ../cart.brep.ts.
 */
import { type Compound } from 'brepjs';

import { cartBodies, stage } from '../cart.brep.js';
import { kitBodies } from '../side-extensions.brep.js';
import { frameSpecks } from '../side-extensions-stacked.brep.js';

export default function sideExtensionsStackedBackdrop(): Compound {
  return stage([...cartBodies(), ...kitBodies(), ...frameSpecks()]);
}
