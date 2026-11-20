/**
 * Accessories stacked on the side extension kit: the bladed tool holder
 * bolted to the outside of the middle post on the right long side, and the
 * tool battery holder bolted on outside it, rails out, through the same two
 * bolts. The post's registration boss locates the bladed tool holder, and a
 * stack locator between the two keys locates the battery holder on it. For
 * rendering only.
 *
 * Drawn against its own backdrop, the kit on the cart
 * (./backdrops/side-extensions-stacked.brep.ts), so only the stack is coloured.
 *
 * Frame as in ./cart.brep.ts.
 */
import {
  box,
  compound,
  getBounds,
  rotate,
  translate,
  type AnyShape,
  type Compound,
} from 'brepjs';

import bladedToolHolder from '../bladed-tool-holder.brep.js';
import { cart, plug } from '../cart.js';
import { defaults as post } from '../side-extension.brep.js';
import { bolt, registration, stackLocator } from '../stacking.js';
import toolBatteryHolder from '../tool-battery-holder.brep.js';
import { cartBodies, half, onRim, RIGHT, sideX, stage } from './cart.brep.js';
import { kitBodies } from './side-extensions.brep.js';

/**
 * Moves an accessory built in a key's frame onto a post, in the post's own key
 * frame: flat against its outside face, `layer` keys out (1 against the post
 * itself), its bolt holes on the post's, and leaning with it.
 */
export function boltedToPost<T extends AnyShape>(shape: T, layer: number): T {
  const beside = translate(shape, [layer * plug.x, 0, cart.cutoutDepth + bolt.standOff]);
  return rotate(beside, post.lean, { at: [0, 0, cart.cutoutDepth], axis: [0, 1, 0] });
}

/** The stacked accessories, and the stack locator between them, in the cart's frame. */
export function stackBodies(): AnyShape[] {
  // The locator sits on the bladed tool holder's outside face, at its registration pocket.
  const locator = translate(stackLocator(), [plug.x / 2, 0, registration.centre]);
  return [
    onRim(boltedToPost(bladedToolHolder(), 1), RIGHT, sideX(1), -half),
    onRim(boltedToPost(locator, 1), RIGHT, sideX(1), -half),
    onRim(boltedToPost(toolBatteryHolder(), 2), RIGHT, sideX(1), -half),
  ];
}

/**
 * Two specks, far too small to see, just outside opposite corners of the
 * stack's bounding box. The renderer frames a model by its bounding box, and
 * the stack reaches out past the wheels, beyond the cart's box. With the
 * specks in both the scene and its backdrop, the two have the same box
 * whatever the stack's exact extent, and render in register.
 */
export function frameSpecks(): AnyShape[] {
  const SPECK = 0.01;
  const PAD = 1;
  const b = getBounds(compound(stackBodies()));
  const speck = (at: [number, number, number]) => box(SPECK, SPECK, SPECK, { centered: true, at });
  return [
    speck([b.xMin - PAD, b.yMin - PAD, b.zMin - PAD]),
    speck([b.xMax + PAD, b.yMax + PAD, b.zMax + PAD]),
  ];
}

export default function sideExtensionsStackedScene(): Compound {
  return stage([...cartBodies(), ...kitBodies(), ...stackBodies(), ...frameSpecks()]);
}
