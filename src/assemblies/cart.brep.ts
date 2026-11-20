/**
 * The cart, schematically, as a backdrop for assembly renders. Not a part: it is
 * never printed, and nothing here is asserted.
 *
 * The rim, its corners and the eight cutouts are placed from the measurements
 * in ../cart.ts, so accessories sit on it as they do on the real cart. The rest
 * (the tub's taper, wheels, frame and handle) is drawn from Gorilla's published
 * overall dimensions and product photos to look right, no more.
 *
 * Units: millimetres. X runs along the cart from the line through the two
 * handle-end cutouts toward the far end; Y is to your left as you stand at the
 * handle end facing the tub; Z is up from the ground.
 */
import {
  box,
  compound,
  cut,
  cylinder,
  fuse,
  rotate,
  Sketcher,
  torus,
  translate,
  type AnyShape,
  type Compound,
  type Sketch,
  type ValidSolid,
  unwrap,
} from 'brepjs';

import { cart, corner, cutoutPitch, handleEndPitch } from '../cart.js';
import { bendPoints } from '../corner-panel.js';
import { single } from '../solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/** Half the span between the long sides' cutout lines. */
export const half = cart.cutoutSpanAcross / 2; // 328

export const tub = {
  /** Top of the rim above the ground: 26.1 in. */
  rimZ: 663,

  /** Tub height: 10.8 in. */
  depth: 274,

  /** The rim, measured from the lines through the cutouts: its inside and outside edges, and how far it hangs down. */
  rimInside: 17,
  rimOutside: cart.rimOutside,
  rimDrop: cart.rimLip,

  /** Far-end rim line and its corner radius. The cart has no cutouts there to place it by. */
  farLine: 966,
  farRadius: 60,

  wall: 4,
  floor: 5,

  /** The tub's floor is its rim outline scaled by this, about a point this far along the cart, so the far end slopes most. */
  taper: 0.8,
  taperCentre: 330,

  /** Plastic around and under each cutout pocket. */
  pocketWall: 4,
} as const;

const wheel = {
  radius: 165, // 13 in tyres
  tyre: 50,
  track: 315, // centre of each wheel from the centreline
  axles: [103, 761], // along the cart
} as const;

const handle = {
  pivot: [-40, 0, tub.rimZ - tub.depth - 20] as [number, number, number],
  length: 720,
  forward: 20, // degrees from upright, leaning away from the tub
  radius: 14,
  grip: 180,
} as const;

/**
 * Turn of the whole scene about Z for the renderer, whose camera is fixed. At 0
 * the iso view looks in over the open far end toward the handle.
 */
const VIEW_TURN = 0;

/** Overshoot so cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** The eight cutouts: centre, and whether the long axis runs along the cart. */
export const cutouts = [
  ...[0, 1, 2].flatMap((k) =>
    [1, -1].map((side) => ({
      x: corner.along + k * cutoutPitch,
      y: side * half,
      alongCart: true,
    })),
  ),
  ...[1, -1].map((side) => ({ x: 0, y: (side * handleEndPitch) / 2, alongCart: false })),
];

type Vec = [number, number];

/**
 * The rim's outline at height `z`, `o` outside the lines through the cutouts.
 * The handle-end corners follow the corner panels' bend; the far-end corners
 * are plain rounds. `map` reshapes it for the tub's floor.
 */
function outline(z: number, o: number, map: (p: Vec) => Vec = (p) => p): Sketch {
  const bend = bendPoints(o);
  const left = (p: Vec) => map([p[0], half + p[1]]);
  const right = (p: Vec) => map([p[0], -(half + p[1])]);

  const r = tub.farRadius + o;
  const cx = tub.farLine - tub.farRadius;
  const cy = half - tub.farRadius;
  const d = r * Math.SQRT1_2;

  return new Sketcher('XY', z)
    .movePointerTo(map([cx / 2, half + o]))
    .lineTo(map([cx, half + o]))
    .threePointsArcTo(map([tub.farLine + o, cy]), map([cx + d, cy + d]))
    .lineTo(map([tub.farLine + o, -cy]))
    .threePointsArcTo(map([cx, -(half + o)]), map([cx + d, -cy - d]))
    .lineTo(right(bend.a))
    .threePointsArcTo(right(bend.flatSide), right(bend.sideMid))
    .lineTo(right(bend.flatEnd))
    .threePointsArcTo(right(bend.b), right(bend.endMid))
    .lineTo(left(bend.b))
    .threePointsArcTo(left(bend.flatEnd), left(bend.endMid))
    .lineTo(left(bend.flatSide))
    .threePointsArcTo(left(bend.a), left(bend.sideMid))
    .close();
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

function tubBody(): ValidSolid {
  const floorZ = tub.rimZ - tub.depth;
  const toFloor = (p: Vec): Vec => [
    tub.taperCentre + tub.taper * (p[0] - tub.taperCentre),
    tub.taper * p[1],
  ];

  const shell = single(
    outline(tub.rimZ, tub.wall - tub.rimInside).loftWith(
      outline(floorZ, tub.wall - tub.rimInside, toFloor),
      { ruled: true },
    ),
  );
  const cavity = single(
    outline(tub.rimZ + OVER, -tub.rimInside).loftWith(
      outline(floorZ + tub.floor, -tub.rimInside, toFloor),
      { ruled: true },
    ),
  );
  const rim = single(outline(tub.rimZ - tub.rimDrop, tub.rimOutside).extrude(tub.rimDrop));

  // A housing under the rim for each cutout, then the cutout itself, blind.
  const along = (c: (typeof cutouts)[number], grow: number): [number, number] =>
    c.alongCart
      ? [cart.cutoutLength + grow, cart.cutoutWidth + grow]
      : [cart.cutoutWidth + grow, cart.cutoutLength + grow];
  const housingDepth = cart.cutoutDepth + tub.pocketWall;

  let body = single(unwrap(fuse(shell, rim)));
  for (const c of cutouts) {
    const [lx, ly] = along(c, 2 * tub.pocketWall);
    const housing = box(lx, ly, housingDepth, {
      centered: true,
      at: [c.x, c.y, tub.rimZ - housingDepth / 2],
    });
    body = single(unwrap(fuse(body, housing)));
  }
  body = single(unwrap(cut(body, cavity)));
  for (const c of cutouts) {
    const [lx, ly] = along(c, 0);
    const pocket = box(lx, ly, cart.cutoutDepth + OVER, {
      centered: true,
      at: [c.x, c.y, tub.rimZ - cart.cutoutDepth / 2 + OVER / 2],
    });
    body = single(unwrap(cut(body, pocket)));
  }
  return body;
}

function wheels(): ValidSolid[] {
  const hubWidth = 70;
  return wheel.axles.flatMap((x) =>
    [1, -1].map((side) => {
      const y = side * wheel.track;
      const tyre = torus(wheel.radius - wheel.tyre, wheel.tyre, {
        at: [x, y, wheel.radius],
        axis: [0, 1, 0],
      });
      const hub = cylinder(wheel.radius - wheel.tyre, hubWidth, {
        at: [x, y - hubWidth / 2, wheel.radius],
        axis: [0, 1, 0],
      });
      return single(unwrap(fuse(tyre, hub)));
    }),
  );
}

function frame(): ValidSolid[] {
  const floorZ = tub.rimZ - tub.depth;
  const spineTop = floorZ;
  const spineHeight = 40;
  const front = handle.pivot[0] - 10;
  const back = wheel.axles[1] + 40;

  const spine = box(back - front, 50, spineHeight, {
    centered: true,
    at: [(front + back) / 2, 0, spineTop - spineHeight / 2],
  });
  const axles = wheel.axles.map((x) =>
    cylinder(12, 2 * wheel.track, { at: [x, -wheel.track, wheel.radius], axis: [0, 1, 0] }),
  );
  const uprights = wheel.axles.map((x) => {
    const height = spineTop - spineHeight - wheel.radius;
    return box(40, 50, height, { centered: true, at: [x, 0, wheel.radius + height / 2] });
  });

  const lean = (handle.forward * Math.PI) / 180;
  const dir: [number, number, number] = [-Math.sin(lean), 0, Math.cos(lean)];
  const top: [number, number, number] = [
    handle.pivot[0] + dir[0] * handle.length,
    0,
    handle.pivot[2] + dir[2] * handle.length,
  ];
  const bar = cylinder(handle.radius, handle.length, { at: handle.pivot, axis: dir });
  const grip = cylinder(handle.radius, handle.grip, {
    at: [top[0], -handle.grip / 2, top[2]],
    axis: [0, 1, 0],
  });

  return [spine, ...axles, ...uprights, bar, grip];
}

/** Every body of the cart, in the cart's own frame. */
export function cartBodies(): AnyShape[] {
  return [tubBody(), ...wheels(), ...frame()];
}

/**
 * Moves something built in a key's frame (cutout floor at z = 0, so the rim at
 * the cutout depth; +X outward across the rim, Y along it) to a point on the
 * rim of the cart, turned about Z by `turn` degrees.
 */
export function onRim<T extends AnyShape>(shape: T, turn: number, x: number, y: number): T {
  return translate(rotate(shape, turn, { axis: [0, 0, 1] }), [x, y, tub.rimZ - cart.cutoutDepth]);
}

/** Turns about Z that point a key's +X out of the cart on each side. */
export const LEFT = 90;
export const RIGHT = -90;
export const HANDLE_END = 180;

/** Position along the cart of the k-th long-side cutout, counting from the handle end. */
export const sideX = (k: number) => corner.along + k * cutoutPitch;

/** Gathers bodies into one scene, turned to face the renderer's camera. */
export function stage(bodies: AnyShape[]): Compound {
  return rotate(compound(bodies), VIEW_TURN, { axis: [0, 0, 1] });
}

export default function cartScene(): Compound {
  return stage(cartBodies());
}
