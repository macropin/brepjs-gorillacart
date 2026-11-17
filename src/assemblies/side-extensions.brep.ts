/**
 * The side extension kit as fitted: eight posts in the cutouts, five side
 * panels between them and a corner panel at each handle-end corner, standing
 * on the schematic cart. For rendering only.
 *
 * Frame as in ./cart.brep.ts: X along the cart from the handle-end cutouts
 * toward the far end, Y to the left seen from the handle end, Z up from the
 * ground.
 */
import { rotate, translate, type AnyShape, type Compound } from 'brepjs';

import { cart, corner, cutoutPitch, handleEndPitch } from '../cart.js';
import cornerPanelLeft from '../corner-panel-left.brep.js';
import cornerPanelRight from '../corner-panel-right.brep.js';
import sideExtension, { grooveOffset, params as post } from '../side-extension.brep.js';
import sidePanel, { params as panel, thickness } from '../side-panel.brep.js';
import { cartBodies, half, stage, tub } from './cart.brep.js';

/** Turns per side, about Z, that point a post's lean (+X in its own frame) out of the cart. */
const LEFT = 90;
const RIGHT = -90;
const HANDLE_END = 180;

/**
 * Moves something built in a post's frame (rim at the cutout depth, +X
 * outward, Y along the rim) to a point on the rim of the cart.
 */
function onRim<T extends AnyShape>(shape: T, turn: number, x: number, y: number): T {
  return translate(rotate(shape, turn, { axis: [0, 0, 1] }), [
    x,
    y,
    tub.rimZ - cart.cutoutDepth,
  ]);
}

/**
 * The side panel stood up in a post's frame, as it sits in the grooves of the
 * posts either side of it: its length along the rim, its outside face outward
 * and its lips inward, in the groove's plane and leaning with it.
 */
function standingPanel() {
  // Flat (length, height, thickness) -> (thickness reversed, length, height).
  const upright = rotate(rotate(sidePanel(), 90, { axis: [1, 0, 0] }), -90, { axis: [0, 0, 1] });
  const inGroove = translate(upright, [
    grooveOffset + thickness / 2,
    0,
    cart.cutoutDepth + panel.height / 2,
  ]);
  return rotate(inGroove, post.lean, { at: [0, 0, cart.cutoutDepth], axis: [0, 1, 0] });
}

/** Every body of the kit, in the cart's frame. */
export function kitBodies(): AnyShape[] {
  const upright = sideExtension();
  const board = standingPanel();
  const sideX = (k: number) => corner.along + k * cutoutPitch;

  const posts = [
    ...[0, 1, 2].flatMap((k) => [
      onRim(upright, LEFT, sideX(k), half),
      onRim(upright, RIGHT, sideX(k), -half),
    ]),
    onRim(upright, HANDLE_END, 0, handleEndPitch / 2),
    onRim(upright, HANDLE_END, 0, -handleEndPitch / 2),
  ];

  // A panel sits midway between each pair of neighbouring posts.
  const panels = [
    ...[0.5, 1.5].flatMap((k) => [
      onRim(board, LEFT, sideX(k), half),
      onRim(board, RIGHT, sideX(k), -half),
    ]),
    onRim(board, HANDLE_END, 0, 0),
  ];

  // The corner panels' own origin is where the two cutout lines cross, at the rim.
  const corners = [
    translate(cornerPanelLeft(), [0, half, tub.rimZ]),
    translate(cornerPanelRight(), [0, -half, tub.rimZ]),
  ];

  return [...posts, ...panels, ...corners];
}

export default function sideExtensionsScene(): Compound {
  return stage([...cartBodies(), ...kitBodies()]);
}
