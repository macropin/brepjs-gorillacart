/**
 * Mounting plate.
 *
 * A flat plate that hangs outside the cart, to bolt or screw a sheet of ply, or
 * anything else, to. The key drops into a rim cutout. From its top a bridge
 * runs outward over the rim, and from the bridge's outer end the plate hangs
 * down outside the rim, clear of it. A grid of M5 holes through the plate takes
 * the bolts or screws, and a row of holes down through the bridge, over the
 * gap, takes more from above. Without the plate, the part is a bracket on the
 * rim: the bridge reaching out past it, with only the holes in its top.
 *
 * The plate can also carry a side extension post's stacking features on its
 * outside face (./stacking.ts): the registration boss, and the two bolt holes
 * through it. An accessory's key then bolts to the plate as it would to a post.
 * They're off unless asked for, as the boss stops a sheet sitting flat.
 *
 * Behind the plate, the rim's outside edge and the housing under the cutout
 * stand about level with each other, all the way down the cutout. The gap
 * between them and the plate is the room for the nuts or screw heads behind
 * it, and for the nuts under the top holes. The plate is as long along the rim
 * as the key, so the whole hook is one profile, square across the rim, run the
 * key's length.
 *
 * That profile prints flat: lie the part on one end, and the key, bridge and
 * plate all build up together, with no supports. Every layer is then a whole
 * hook, so the load bends the part within its layers, not across them.
 *
 * It doesn't stack: with the side extension kit fitted, every cutout holds a
 * post.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it. +X is outward, so fit it with the plate
 * outside the cart. The rim is at z = insertDepth.
 */
import { cut, draw, fuse, Sketcher, unwrap, type ValidSolid } from 'brepjs';

import { cart, plugFor } from './cart.js';
import { key, keyChamfer, keySectionArea } from './key.js';
import { atLeast, DesignError, fitToleranceSpec, on, type Numeric, type Schema } from './params.js';
import { single } from './solid.js';
import { bolt, frustum, frustumVolume, registration as reg, teardropArea } from './stacking.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const defaults = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** The bridge's thickness, standing on the rim. */
  bridgeThickness: 4,

  /**
   * Clear gap between the rim's outside edge and the plate. At 5 mm the plate
   * sits close, and bolts go in from behind it, their low heads in the gap. 10
   * mm takes an M5 nut, washer and bolt end behind the plate instead, and from
   * TOP_HOLE_GAP there's room under the bridge for a nut on a top hole's bolt.
   */
  gap: 5,

  /**
   * The plate: 1 to hang it from the bridge, 0 to leave it off. Its thickness,
   * and how far it hangs below the rim's top. Without it, the bridge still
   * reaches as far out, to where the plate's outside face would be.
   */
  plate: 1,
  plateThickness: 4,
  drop: 100,

  /** Holes through the plate, a grid of them: clearance for M5. */
  holeColumns: 2,
  holeRows: 2,
  holeDiameter: 5.5,

  /**
   * Holes down through the bridge, over the gap: 1 for one above each column of
   * the plate's, 0 for none. Always there without the plate.
   */
  topHoles: 1,

  /**
   * Room a nut needs to turn under the bridge, out from a top hole's centre: an
   * M5 nut is 9.2 mm across its corners, and its washer 10 mm across.
   */
  nutRoom: 5,

  /**
   * The stacking features on the plate's outside face, centred down its drop:
   * the registration boss, and the two M5 bolt holes through it. 1 to include
   * each, 0 to leave it off. The plate's own holes that would land on the boss
   * are left out.
   */
  registration: 0,
  boltHoles: 0,

  /**
   * Outer hole centres in from the plate's ends and bottom edge, and the top
   * row's below the rim's top, clear of the inside corner's round for a washer.
   */
  edgeMargin: 10,
  topMargin: 10,

  /**
   * Rounds the bridge's top corners, for hands, and its outer bottom one without
   * the plate. There the end's two rounds shrink to leave `endFlat` between them
   * on a thin bridge.
   */
  cornerRadius: 2,
  endFlat: 1,

  /**
   * Rounds the inside corner under the bridge, where the plate's load bends it
   * hardest: `insideRadius` from a gap of `insideRoundGap`, and `tightInsideRadius`
   * in a tighter one, where a bigger round would crowd the rim.
   */
  insideRadius: 4,
  tightInsideRadius: 1,
  insideRoundGap: 7,

  /** Printed-fit slop, taken off the cutout's width and length. */
  fitTolerance: cart.fitTolerance,
} as const;

export type Params = Numeric<typeof defaults>;

const WITH_PLATE = { plate: [1] };

/**
 * The gap the top holes need: room under the bridge for a nut to turn, between
 * the rim's outside edge and the inside corner's round. Without the plate, the
 * bridge reaches this far past the rim, for them.
 */
export const TOP_HOLE_GAP = 2 * defaults.nutRoom + defaults.insideRadius; // 14

export const schema: Schema<Params> = {
  plate: {
    kind: 'toggle',
    label: 'Hanging plate',
    min: 0,
    max: 1,
    help: 'Down outside the rim. Without it, the part is a bracket on the rim, with its holes in the top.',
  },
  drop: {
    label: 'Plate drop',
    unit: 'mm',
    min: 50,
    max: 200,
    step: 5,
    help: 'How far the plate hangs below the top of the rim.',
    when: WITH_PLATE,
  },
  plateThickness: {
    label: 'Plate thickness',
    unit: 'mm',
    min: 3,
    max: 8,
    step: 0.5,
    help: 'Thicker is stiffer, for heavier loads.',
    when: WITH_PLATE,
  },
  bridgeThickness: {
    label: 'Bridge thickness',
    unit: 'mm',
    min: 3,
    max: 15,
    step: 0.5,
    help: 'Over the rim, carrying the plate or what sits on top.',
  },
  gap: {
    label: 'Gap to the rim',
    unit: 'mm',
    min: 3,
    max: 30,
    step: 0.5,
    help: 'Past the rim’s outside edge, to the plate. From 10 mm a nut fits behind the plate; from 14 mm the top can have holes.',
    when: WITH_PLATE,
  },
  holeColumns: {
    label: 'Hole columns',
    unit: '',
    min: 2,
    max: 3,
    step: 1,
    help: 'Along the rim, in the plate and the top.',
    group: 'Holes',
  },
  holeRows: {
    label: 'Hole rows',
    unit: '',
    min: 2,
    max: 5,
    step: 1,
    help: 'Spread evenly down the plate, below the bridge.',
    group: 'Holes',
    when: WITH_PLATE,
  },
  holeDiameter: {
    label: 'Hole diameter',
    unit: 'mm',
    min: 3,
    max: 7,
    step: 0.1,
    help: 'In the plate and the top. 5.5 mm clears an M5 bolt or screw; 3.4 mm an M3, 6.5 mm an M6.',
    group: 'Holes',
  },
  topHoles: {
    kind: 'toggle',
    label: 'Holes in the top',
    min: 0,
    max: 1,
    help: 'Down through the bridge over the gap, one above each column, with room for a nut underneath.',
    group: 'Holes',
    when: { ...WITH_PLATE, gap: { min: TOP_HOLE_GAP } },
  },
  registration: {
    kind: 'toggle',
    label: 'Registration boss',
    min: 0,
    max: 1,
    help: 'On the plate’s outside face, as on a side extension post, for an accessory’s key to locate on.',
    group: 'Stacking',
    when: WITH_PLATE,
  },
  boltHoles: {
    kind: 'toggle',
    label: 'Bolt holes',
    min: 0,
    max: 1,
    help: 'Two M5 holes through the boss, as on a post, to bolt an accessory’s key on. The nuts go behind the plate.',
    group: 'Stacking',
    when: WITH_PLATE,
  },
  fitTolerance: fitToleranceSpec,
};

/** At least this many holes, so a sheet can't pivot on them. */
const MIN_HOLES = 3;

/** Closest hole centres can sit, for washers side by side. */
const MIN_PITCH = 12;

/** Plate left round the registration boss: above and below it, and to the holes beside it. */
const BOSS_CLEAR = 3;

/** Clearance left at least between the inside corner's round and the rim. */
const CORNER_CLEAR = 1;

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function design(params: Params = defaults) {
  const plug = plugFor(params.fitTolerance);
  const half = plug.x / 2; // 9.6

  const plate = on(params.plate);

  const rim = params.insertDepth; // 63.5
  const top = rim + params.bridgeThickness; // 67.5
  const bottom = rim - params.drop; // -36.5

  /** The gap to the plate; without it, how far the bridge reaches past the rim, for the top holes. */
  const gap = plate ? params.gap : TOP_HOLE_GAP;

  /** The plate's inside and outside faces. */
  const inside = cart.rimOutside + gap; // 19
  const outside = inside + params.plateThickness; // 23

  /** Without the plate, the rounds top and bottom of the bridge's end, which share its thickness. */
  const endRadius = Math.min(params.cornerRadius, (params.bridgeThickness - params.endFlat) / 2);

  /** The inside corner's round: smaller in a tight gap, to stop short of the rim. */
  const innerRadius = gap >= params.insideRoundGap ? params.insideRadius : params.tightInsideRadius;

  for (const [name, value] of [
    ['holeColumns', params.holeColumns],
    ['holeRows', params.holeRows],
  ] as const) {
    if (!Number.isInteger(value)) throw new DesignError(`${name} must be a whole number`);
  }
  if (plate && params.holeColumns * params.holeRows < MIN_HOLES) {
    throw new DesignError(`The plate needs at least ${MIN_HOLES} holes`);
  }
  atLeast('The clearance between the inside corner’s round and the rim', gap - innerRadius, CORNER_CLEAR);

  /** Hole centres along the rim, and up the plate, evenly spread. */
  const spread = (from: number, to: number, count: number) =>
    count === 1
      ? [(from + to) / 2]
      : Array.from({ length: count }, (_, i) => from + ((to - from) * i) / (count - 1));
  const edge = plug.y / 2 - params.edgeMargin; // 15.5
  const lowest = bottom + params.edgeMargin;
  const highest = rim - params.topMargin;
  const columns = spread(-edge, edge, params.holeColumns);
  const rows = plate ? spread(lowest, highest, params.holeRows) : [];

  if (params.holeColumns > 1) {
    atLeast('The space between hole columns', (2 * edge) / (params.holeColumns - 1), MIN_PITCH);
  }
  if (plate) {
    atLeast('The room for holes down the plate', highest - lowest, 0);
    if (params.holeRows > 1) {
      atLeast('The space between hole rows', (highest - lowest) / (params.holeRows - 1), MIN_PITCH);
    }
  }

  const holeR = params.holeDiameter / 2;

  /**
   * The stacking features, centred down the plate: the registration boss on its
   * outside face, and the bolt holes through plate and boss at the accessory
   * keys' spacing, 30 mm apart. No nut pockets: the plate is too thin, so the
   * nuts go behind it, in the gap.
   */
  const boss = plate && on(params.registration);
  const bossHoles = plate && on(params.boltHoles);
  const bossZ = rim - params.drop / 2;
  const bossHoleZs = bolt.heights.map((h) => bossZ + h - reg.centre);
  const bossHoleR = bolt.holeDiameter / 2;
  if (boss || bossHoles) {
    atLeast('The plate below the registration boss', bossZ - reg.length / 2 - bottom, BOSS_CLEAR);
    atLeast('The plate above the registration boss', rim - bossZ - reg.length / 2, BOSS_CLEAR);
  }

  /** The plate's own holes, less any that would land on the boss: a middle column's. */
  const onBoss = (y: number, z: number) =>
    (boss || bossHoles) &&
    Math.abs(y) < reg.width / 2 + holeR + BOSS_CLEAR &&
    Math.abs(z - bossZ) < reg.length / 2 + holeR + BOSS_CLEAR;
  const plateHoles = rows.flatMap((z) =>
    columns.filter((y) => !onBoss(y, z)).map((y): [number, number] => [y, z]),
  );

  /**
   * The top holes go down through the bridge over the gap, in the middle of the
   * room under it: from the rim's outside edge to where the inside corner's
   * round starts. A nut has to turn there, against the bridge's underside, so
   * with the plate they need a gap of TOP_HOLE_GAP. Without the plate the
   * bridge reaches that far, and they're the part's only holes.
   */
  const topHoles = plate ? params.gap >= TOP_HOLE_GAP && on(params.topHoles) : true;
  const underBridge = inside - innerRadius - cart.rimOutside; // 1, or 10 at TOP_HOLE_GAP
  const topHoleX = cart.rimOutside + underBridge / 2;
  if (topHoles) {
    atLeast('The room under the bridge for a nut on a top hole', underBridge, 2 * params.nutRoom);
  }

  /**
   * The holes are teardrops pointing along +Y: the part prints on its -Y end, so
   * that is up, and the holes need no support.
   */
  function hole(y: number, z: number, r = holeR, depth = params.plateThickness): ValidSolid {
    const t = r / Math.SQRT2;
    return single(
      new Sketcher('YZ', inside - OVER)
        .movePointerTo([y + t, z + t])
        .threePointsArcTo([y + t, z - t], [y - r, z])
        .lineTo([y + r * Math.SQRT2, z])
        .close()
        .extrude(depth + 2 * OVER),
    );
  }

  /**
   * The cut that chamfers the bridge's upright corner on its inside face, at the
   * `side` end along the rim: a prism, its long face on the plane of the key's
   * own chamfer there, reaching OVER past the faces and below the bridge.
   */
  function insideChamfer(side: 1 | -1): ValidSolid {
    const end = side * (plug.y / 2);
    const c = keyChamfer;
    const corner: [number, number] = [-half - OVER, end + side * OVER];
    const alongEnd: [number, number] = [-half + c + OVER, end + side * OVER];
    const downFace: [number, number] = [-half - OVER, end - side * (c + OVER)];
    return single(
      new Sketcher('XY', rim - OVER)
        .movePointerTo(corner)
        .lineTo(alongEnd)
        .lineTo(downFace)
        .close()
        .extrude(params.bridgeThickness + 2 * OVER),
    );
  }

  /** A hole down through the bridge, at `y` along the rim. */
  function topHole(y: number): ValidSolid {
    const t = holeR / Math.SQRT2;
    return single(
      new Sketcher('XY', rim - OVER)
        .movePointerTo([topHoleX + t, y + t])
        .threePointsArcTo([topHoleX - t, y + t], [topHoleX, y - holeR])
        .lineTo([topHoleX, y + holeR * Math.SQRT2])
        .close()
        .extrude(params.bridgeThickness + 2 * OVER),
    );
  }

  function model(): ValidSolid {
    // The hook's profile in XZ: the bridge from the key's inside face out over
    // the rim, and the plate down from its outer end. Its bottom edge runs along
    // the rim's top, over the key, which it joins. Without the plate, the
    // bridge's end comes straight down to its underside, rounded there too.
    const bridge = draw([-half, rim])
      .lineTo([-half, top])
      .customCorner(params.cornerRadius)
      .lineTo([outside, top])
      .customCorner(plate ? params.cornerRadius : endRadius);
    const profile = plate
      ? bridge
          .lineTo([outside, bottom])
          .lineTo([inside, bottom])
          .lineTo([inside, rim])
          .customCorner(innerRadius)
          .close()
      : bridge.lineTo([outside, rim]).customCorner(endRadius).close();

    // The XZ plane's normal is -Y, so start the sketch at +Y and extrude back
    // across the key's full length.
    let hook = single(profile.sketchOnPlane('XZ', [0, plug.y / 2, 0]).extrude(plug.y));

    // Carry the key's chamfers on up the bridge's inside face to its top: a 45°
    // cut down each upright corner there, the same as the key's. Cut before the
    // bridge joins the key, so it starts below the bridge, clear of any face.
    for (const side of [1, -1] as const) hook = single(unwrap(cut(hook, insideChamfer(side))));

    let part = single(unwrap(fuse(key(params.insertDepth, plug), hook)));

    // The boss starts OVER inside the plate's face, so it fuses in cleanly.
    if (boss) {
      const bossSolid = frustum(reg.width + 2 * OVER, reg.length + 2 * OVER, reg.height + OVER, outside - OVER, bossZ, 1);
      part = single(unwrap(fuse(part, bossSolid)));
    }

    for (const [y, z] of plateHoles) part = single(unwrap(cut(part, hole(y, z))));
    if (bossHoles) {
      const depth = params.plateThickness + (boss ? reg.height : 0);
      for (const z of bossHoleZs) part = single(unwrap(cut(part, hole(0, z, bossHoleR, depth))));
    }
    if (topHoles) {
      for (const y of columns) part = single(unwrap(cut(part, topHole(y))));
    }
    return part;
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  // The key below the rim, plus the hook's profile across the key's length: the
  // bridge over the rim and the plate below it. Each rounded corner turns 90°:
  // the two on top trim r²(1 − π/4) from the profile, and the inside one fills
  // as much in. Less the holes, teardrops through the plate and the bridge, and
  // the inside chamfers: a c²/2 triangle up each corner, full size up to the
  // inside top round, then less of it, where the round has already taken the
  // corner's material (by Simpson's rule).
  const roundTrim = (r: number) => r ** 2 * (1 - Math.PI / 4);
  const chamferArea = keyChamfer ** 2 / 2;
  const r = params.cornerRadius;
  const inRound = (h: number) => {
    const taken = r - Math.sqrt(r ** 2 - h ** 2); // how far the round sets the face back
    return Math.max(0, keyChamfer - taken) ** 2 / 2;
  };
  const STEPS = 64;
  let roundChamfer = 0;
  for (let i = 0; i <= STEPS; i++) {
    const weight = i === 0 || i === STEPS ? 1 : i % 2 ? 4 : 2;
    roundChamfer += (weight * inRound((r * i) / STEPS) * r) / (3 * STEPS);
  }
  const insideChamferVolume = 2 * (chamferArea * (params.bridgeThickness - r) + roundChamfer);
  const profileArea = plate
    ? (outside + half) * params.bridgeThickness +
      params.plateThickness * params.drop -
      2 * roundTrim(params.cornerRadius) +
      roundTrim(innerRadius)
    : (outside + half) * params.bridgeThickness -
      roundTrim(params.cornerRadius) -
      2 * roundTrim(endRadius);
  const holeCount = plateHoles.length;
  const topHoleCount = topHoles ? params.holeColumns : 0;

  const expected = {
    volume:
      keySectionArea(plug) * params.insertDepth +
      profileArea * plug.y -
      holeCount * teardropArea(holeR) * params.plateThickness -
      topHoleCount * teardropArea(holeR) * params.bridgeThickness -
      insideChamferVolume +
      (boss ? frustumVolume(reg.width, reg.length, reg.height) : 0) -
      (bossHoles
        ? bossHoleZs.length *
          teardropArea(bossHoleR) *
          (params.plateThickness + (boss ? reg.height : 0))
        : 0),
    bounds: {
      xMin: -half,
      xMax: boss ? outside + reg.height : outside,
      yMin: -plug.y / 2,
      yMax: plug.y / 2,
      zMin: plate ? Math.min(0, bottom) : 0,
      zMax: top,
    },
    tolerancePct: 0.1,
  };

  return { model, expected, holes: { plateHoles, topHoleX, bossHoleZs }, inside, outside };
}

const standard = design();

export default function mountingPlate(): ValidSolid {
  return standard.model();
}

export const { expected, holes, inside, outside } = standard;
