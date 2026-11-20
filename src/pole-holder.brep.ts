/**
 * Pole tool holder.
 *
 * Carries a long-handled tool along the rim, in a pair of holders in
 * neighbouring cutouts. The key bar drops into a rim cutout and carries a clip
 * on its top face, extruded the full 51mm along Y, and the pole lies along the
 * rim. The clip comes in two forms, chosen with `clip`:
 *
 * - Compliant, the default: two hooks round the pole, each hanging from a head
 *   carried on a pair of thin curved bands, so the heads swing well clear to
 *   let the pole in and the snap can be much deeper. See ./compliant-clip.ts.
 * - Rigid: a U whose side profile is the convex hull of the bar's top edge and
 *   a circle around the pole, cut flat a little above the pole centre so the
 *   opening is narrower than the bore and the pole snaps in. The whole U has to
 *   spring open, so the snap is shallow. By default each lip is rolled over
 *   into a cylinder along its edge, for the pole to roll in over; without it
 *   the lip is left flat. ./pole-holder-rigid.brep.ts builds it.
 *
 * Units and axes as in ./key.ts: Z up from the cutout floor at z = 0, centred
 * in X/Y, X across the rim, Y along it. The rim is at z = insertDepth.
 */
import {
  chamfer,
  cone,
  curvePointAt,
  cut,
  cylinder,
  draw,
  edgeFinder,
  fuse,
  unwrap,
  type Edge,
  type ValidSolid,
} from 'brepjs';

import { cart, plugFor } from './cart.js';
import { compliantClip } from './compliant-clip.js';
import { key, keySectionArea } from './key.js';
import { add, Outline, scale, sub, unit, type Point } from './outline.js';
import { atLeast, DesignError, fitToleranceSpec, on, type Numeric, type Schema } from './params.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

/** The clip's form, as the `clip` parameter numbers it. */
export const CLIPS = { rigid: 0, compliant: 1 } as const;

const RIGID = { clip: [CLIPS.rigid] };
const COMPLIANT = { clip: [CLIPS.compliant] };

export const defaults = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** Bar above the rim, under the clip. */
  standHeight: 50,

  /** Outside diameter of the tool pole. The bore adds the fit tolerance. */
  poleDiameter: 25.3,

  /** Compliant clip or rigid snap clip. See CLIPS. */
  clip: CLIPS.compliant,

  /**
   * Breaks every edge of the clip's two end faces, outer profile and bore mouth
   * alike, so the pole and hands meet no sharp edge. The base of the clip, where
   * it meets the bar, is left square. On the compliant clip it goes round the
   * outline but not the slots, and is no more than half a band, so each band
   * keeps at least half its thickness at the ends.
   */
  edgeChamfer: 1,

  // The rigid clip.

  /** Clip wall around the bore, and the floor under it. */
  wall: 3,

  /**
   * Height of the flat top cut above the bore centre. Anything above zero
   * leaves the opening narrower than the bore, which is what retains the pole.
   */
  lipHeight: 4,

  /**
   * Rolls each lip of the rigid clip over into a cylinder along its edge: 1 to
   * include it, 0 for the flat lip. The roll is tangent to the bore where the bore meets the lip,
   * so the bore runs smoothly over into it, and the pole meets a round instead
   * of an edge as it goes in.
   */
  rolledEdge: 1,

  /**
   * How far each roll stands out past the clip's outside, measured from the
   * pole's centre. The roll's diameter is the wall plus this: at 0 it just
   * rounds the lip off.
   */
  rollBulge: 1,

  // The compliant clip (./compliant-clip.ts).

  /**
   * How much narrower than the pole the opening between the heads is. Each
   * hook swings out half of it to let the pole past, and back once it is in.
   */
  snap: 5,

  /** Thickness of each spring band, and of every wall in the heads. */
  bandThickness: 2,

  /** The hooks round the pole: thickness, clear gap to the inner band, and where each tip ends, in degrees round from the top of the bore. */
  hookThickness: 4,
  hookGap: 5,
  hookEnd: 150,

  /** Width of the slot between the two bands, and the round at its end inside the head. */
  slotWidth: 3,
  slotEndRadius: 1,

  /** Printed-fit slop, taken off the cutout's width and length and added to the bore. */
  fitTolerance: cart.fitTolerance,
} as const;

export type Params = Numeric<typeof defaults>;

export const schema: Schema<Params> = {
  poleDiameter: {
    label: 'Pole diameter',
    unit: 'mm',
    min: 16,
    max: 40,
    step: 0.1,
    help: 'Outside diameter of the tool handle. The bore adds the fit tolerance.',
  },
  clip: {
    kind: 'choice',
    label: 'Clip',
    options: [
      { value: CLIPS.compliant, label: 'Compliant' },
      { value: CLIPS.rigid, label: 'Rigid' },
    ],
    help: 'Compliant hangs the hooks on spring bands, for a deep snap in PETG. Rigid is compact, with a shallow snap.',
  },
  lipHeight: {
    label: 'Snap lip height',
    unit: 'mm',
    min: 1,
    max: 7,
    step: 0.5,
    help: 'Where the bore ends, above the pole centre: the flat top, or the start of the roll. Higher narrows the opening and grips tighter.',
    when: RIGID,
  },
  wall: {
    label: 'Clip wall',
    unit: 'mm',
    min: 2,
    max: 6,
    step: 0.5,
    help: 'Thicker is stiffer, and harder to snap the pole into.',
    when: RIGID,
  },
  rolledEdge: {
    kind: 'toggle',
    label: 'Rolled leading edge',
    min: 0,
    max: 1,
    help: 'Rolls each lip over into a round, so the pole rolls in over it instead of meeting an edge.',
    when: RIGID,
  },
  rollBulge: {
    label: 'Roll bulge',
    unit: 'mm',
    min: 0,
    max: 2,
    step: 0.25,
    help: 'How far each roll stands out past the clip. At 0 it just rounds the lip off.',
    when: { ...RIGID, rolledEdge: [1] },
  },
  snap: {
    label: 'Snap',
    unit: 'mm',
    min: 2,
    max: 6,
    step: 0.5,
    help: 'How much narrower than the pole the opening is. Deeper holds tighter, and takes a firmer push.',
    when: COMPLIANT,
  },
  bandThickness: {
    label: 'Spring band thickness',
    unit: 'mm',
    min: 1.5,
    max: 3,
    step: 0.1,
    help: 'Thicker bands are stiffer: the pole takes more force to snap in and out.',
    when: COMPLIANT,
  },
  standHeight: {
    label: 'Height above the rim',
    unit: 'mm',
    min: 10,
    max: 150,
    step: 1,
    help: 'Bar between the rim and the clip.',
  },
  fitTolerance: fitToleranceSpec,
};

/** Overshoot so through-cuts clear the faces instead of leaving zero-thickness skins. */
const OVER = 1;

/** Radius of the round blending a bulging roll into the clip's outside. */
const ROLL_BLEND = 1;

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

/** The part's declared intent, as `brep verify --check` asserts it. */
interface Expected {
  volume: number;
  bounds: Record<'xMin' | 'xMax' | 'yMin' | 'yMax' | 'zMin' | 'zMax', number>;
  tolerancePct: number;
}

interface Built {
  model(): ValidSolid;
  expected: Expected;
  /** Across the clip's mouth, where the pole goes in. */
  opening: number;
  /** The rigid clip's flat lip either side of the opening. */
  lipWidth?: number;
}

export function design(params: Params = defaults): Built {
  const plug = plugFor(params.fitTolerance);

  const rim = params.insertDepth; // 63.5

  /** Bar height: 63.5 + 50 = 113.5. */
  const height = rim + params.standHeight;

  const boreR = (params.poleDiameter + params.fitTolerance) / 2; // 12.8

  if (params.clip === CLIPS.compliant) return compliantDesign(params, height, boreR);
  if (params.clip !== CLIPS.rigid) {
    throw new DesignError(`clip is ${params.clip}: 0 for rigid, 1 for compliant`);
  }

  const outerR = boreR + params.wall; // 15.8

  /** In clip coordinates, z = 0 on the bar's top face. The outer circle sits on it. */
  const centreZ = outerR; // 15.8
  const cutZ = centreZ + params.lipHeight; // 19.8

  /** Half the bar's top edge; the profile's side lines run from here. */
  const halfBase = plug.x / 2; // 9.6

  // The opening must stay open, and narrower than the pole: the lip below the
  // top of the bore by a good margin.
  if (!(params.lipHeight < 0.6 * boreR)) {
    throw new DesignError(
      `The snap lip must sit well below the top of the bore: under ${Math.floor(6 * boreR) / 10} mm for this pole`,
    );
  }

  /**
   * Where the side line from the base corner meets the outer circle tangentially.
   * `beta` is the angle at the centre between the base corner and the circle's
   * bottom point; the tangent point sits the same angle the other side of it.
   */
  const toCorner = Math.atan2(-centreZ, halfBase);
  const beta = Math.acos(outerR / Math.hypot(halfBase, centreZ));
  const tangent: [number, number] = [
    outerR * Math.cos(toCorner + beta),
    centreZ + outerR * Math.sin(toCorner + beta),
  ]; // (14.02, 8.52)

  /** Half-widths of the outer edge and the bore at the top cut. */
  const outerAtCut = Math.sqrt(outerR ** 2 - params.lipHeight ** 2); // 15.285
  const boreAtCut = Math.sqrt(boreR ** 2 - params.lipHeight ** 2); // 12.159

  /** Snap opening across the top, and the flat lip either side of it. */
  const opening = 2 * boreAtCut; // 24.32
  const lipWidth = outerAtCut - boreAtCut; // 3.13

  if (on(params.rolledEdge)) {
    return rolledDesign(params, { height, boreR, outerR, centreZ, halfBase, tangent, beta });
  }

  atLeast('The flat lip either side of the opening', lipWidth, 2 * params.edgeChamfer);

  function model(): ValidSolid {
    const bar = key(height, plug);

    // The clip's outer profile in XZ, already cut flat across the top. Each arc is
    // pinned by a point on the circle level with its centre, which lies between
    // the tangent point and the cut on either side.
    const profile = draw([-halfBase, 0])
      .lineTo([halfBase, 0])
      .lineTo(tangent)
      .threePointsArcTo([outerAtCut, cutZ], [outerR, centreZ])
      .lineTo([-outerAtCut, cutZ])
      .threePointsArcTo([-tangent[0], tangent[1]], [-outerR, centreZ])
      .close()
      .translate(0, height);

    // The XZ plane's normal is -Y, so start the sketch at +Y and extrude back
    // across the full length.
    let clip = single(profile.sketchOnPlane('XZ', [0, plug.y / 2, 0]).extrude(plug.y));

    const bore = cylinder(boreR, plug.y + 2 * OVER, {
      at: [0, -plug.y / 2 - OVER, height + centreZ],
      axis: [0, 1, 0],
    });

    // The end-face chamfer goes on in two steps, because OCCT fails to chamfer
    // the outer profile once the clip is joined to the bar. First the outer
    // profile on the clip alone: every edge of both end faces except the base,
    // which is joined to the bar.
    const onEnd = (edge: Edge) =>
      Math.abs(Math.abs(curvePointAt(edge, 0.5)[1]) - plug.y / 2) < 1e-6;
    const c = params.edgeChamfer;
    if (c > 0) {
      const onProfile = (edge: Edge) => onEnd(edge) && curvePointAt(edge, 0.5)[2] > height + 1e-6;
      clip = single(unwrap(chamfer(clip, edgeFinder().when(onProfile), c)));
    }

    const part = single(unwrap(cut(single(unwrap(fuse(bar, clip))), bore)));
    if (c <= 0) return part;

    // Then the bore mouths, once the bore is cut.
    const onBoreMouth = (edge: Edge) => {
      const [x, , z] = curvePointAt(edge, 0.5);
      return onEnd(edge) && Math.abs(Math.hypot(x, z - height - centreZ) - boreR) < 1e-6;
    };
    const mouths = chamfer(part, edgeFinder().when(onBoreMouth), c);
    if (mouths.ok) return single(mouths.value);

    // OCCT's chamfer fails on some clips, where a mouth meets the lip's own
    // chamfer. A 45° countersink cut into each end face makes the same bevel
    // round the bore. It runs from OVER outside the face, where it is c + OVER
    // wider than the bore, in to OVER past the bevel's foot.
    let sunk = part;
    for (const side of [1, -1] as const) {
      const sink = cone(boreR + c + OVER, boreR - OVER, c + 2 * OVER, {
        at: [0, side * (plug.y / 2 + OVER), height + centreZ],
        axis: [0, -side, 0],
      });
      sunk = single(unwrap(cut(sunk, sink)));
    }
    return sunk;
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  /** Area of a circle of radius `r` lying below a chord `d` above its centre. */
  const belowChord = (r: number, d: number) =>
    Math.PI * r ** 2 - (r ** 2 * Math.acos(d / r) - d * Math.sqrt(r ** 2 - d ** 2));

  // Clip profile: the outer circle below the cut, plus the sliver either side
  // between the base, the side line and the circle (a kite of two right triangles
  // less the sector they span), less the bore below the cut.
  const clipArea =
    belowChord(outerR, params.lipHeight) +
    2 * (outerR * halfBase - outerR ** 2 * beta) -
    belowChord(boreR, params.lipHeight);

  // The end-face chamfer takes a c²/2 triangle along each edge of both end
  // profiles: straight along the side lines and lips, and swept round the arcs
  // (Pappus), its centroid c/3 in from the outer circle and c/3 out from the
  // bore. The mitres where the arcs meet the lips are left to the tolerance.
  const c = params.edgeChamfer;
  const sideLine = Math.hypot(tangent[0] - halfBase, tangent[1]);
  const outerArc = Math.atan2(params.lipHeight, outerAtCut) - (toCorner + beta);
  const boreArc = Math.PI + 2 * Math.asin(params.lipHeight / boreR);
  const chamferPerEnd =
    (c ** 2 / 2) *
    (2 * sideLine +
      2 * lipWidth +
      2 * outerArc * (outerR - c / 3) +
      boreArc * (boreR + c / 3));

  const expected = {
    volume: keySectionArea(plug) * height + clipArea * plug.y - 2 * chamferPerEnd,
    bounds: {
      xMin: -outerR,
      xMax: outerR,
      yMin: -plug.y / 2,
      yMax: plug.y / 2,
      zMin: 0,
      zMax: height + cutZ,
    },
    tolerancePct: 0.1,
  };

  return { model, expected, opening, lipWidth };
}

/**
 * The rigid clip with its lips rolled over: in place of the flat cut, each lip
 * ends in a roll, a cylinder along Y. The roll is tangent to the bore where the
 * flat lip's inner corner was, at the lip height, with its centre out along the
 * radius through that point, so the bore runs smoothly over into it. Its
 * diameter is the wall plus `rollBulge`, so it stands that far proud of the
 * outer circle, and crosses it below the mouth, where a 1 mm round blends the
 * two. At no bulge it is tangent to the outer circle too, and the lip ends in
 * a plain half-round.
 *
 * Tangent arcs don't sit well in OCCT booleans, so the profile is drawn whole,
 * bore and rolls included, as one outline, extruded and joined to the bar.
 */
function rolledDesign(
  params: Params,
  rigid: {
    height: number;
    boreR: number;
    outerR: number;
    centreZ: number;
    halfBase: number;
    tangent: Point;
    beta: number;
  },
): Built {
  const { height, boreR, outerR, centreZ, halfBase, tangent, beta } = rigid;
  const plug = plugFor(params.fitTolerance);
  const centre: Point = [0, centreZ];

  /** A point `r` from the pole's centre at `angle` above level, on the right (+1) or left (−1). */
  const at = (side: 1 | -1, r: number, angle: number): Point => [
    side * r * Math.cos(angle),
    centreZ + r * Math.sin(angle),
  ];

  /** The mouth, where the bore meets the roll: the flat lip's inner corner, at the lip height. */
  const mouthAngle = Math.asin(params.lipHeight / boreR);

  const rollR = (params.wall + params.rollBulge) / 2; // 2
  const rollCentreR = boreR + rollR; // 14.8

  const roll = at(1, rollCentreR, mouthAngle);
  const mouth = at(1, boreR, mouthAngle);

  // Where the roll crosses the outer circle, below the mouth's radius by the
  // angle at the pole's centre in the triangle of the two centres and that
  // point. With no bulge they touch on the radius itself.
  const cosMeet = (rollCentreR ** 2 + outerR ** 2 - rollR ** 2) / (2 * rollCentreR * outerR);
  const meetAngle = mouthAngle - Math.acos(Math.min(1, cosMeet)); // 11.7°
  const meet = at(1, outerR, meetAngle);

  // A bulging roll meets the outer circle at a crease, which OCCT can't
  // chamfer across, and which would gather strain at the roll's root. Blend it
  // with a round outside both, tangent to each: its centre is a round's radius
  // further out from each centre than its circle, on the crease's side of the
  // line between them.
  const blended = params.rollBulge > 1e-6;
  const f = ROLL_BLEND;
  const toBlend = outerR + f;
  const along = (rollCentreR ** 2 + toBlend ** 2 - (rollR + f) ** 2) / (2 * rollCentreR);
  const across = Math.sqrt(Math.max(0, toBlend ** 2 - along ** 2));
  const blend: Point = [
    along * Math.cos(mouthAngle) + across * Math.sin(mouthAngle),
    centreZ + along * Math.sin(mouthAngle) - across * Math.cos(mouthAngle),
  ];
  const offCircle = (c: Point, r: number, toward: Point): Point => add(c, scale(unit(sub(toward, c)), r));
  /** Where the outline leaves the outer circle, and where it reaches the roll. */
  const leave = blended ? offCircle(centre, outerR, blend) : meet;
  const reach = blended ? offCircle(roll, rollR, blend) : meet;

  const tangentAngle = Math.atan2(tangent[1] - centreZ, tangent[0]); // −27.4°
  if (!(Math.atan2(leave[1] - centreZ, leave[0]) > tangentAngle + 0.05)) {
    throw new DesignError("The roll would reach down past the clip's side: raise the snap lip, or make the roll smaller");
  }

  const left = (p: Point): Point => [-p[0], p[1]];
  const outline = new Outline([-halfBase, 0]).lineTo([halfBase, 0]).lineTo(tangent).arcTo(centre, leave, 'ccw');
  if (blended) outline.arcTo(blend, reach, 'cw');
  outline
    .arcTo(roll, mouth, 'ccw') // over the roll
    .arcTo(centre, left(mouth), 'cw') // the bore
    .arcTo(left(roll), left(reach), 'ccw');
  if (blended) outline.arcTo(left(blend), left(leave), 'cw');
  outline.arcTo(centre, left(tangent), 'ccw').close();

  /**
   * The end-face chamfer, round the whole outline. No more than half the roll,
   * or a third of the wall, so a thin wall keeps a flat between the chamfers
   * on its two faces.
   */
  const c = Math.min(params.edgeChamfer, rollR / 2, params.wall / 3);
  const aboveBase = (from: Point, to: Point) => Math.max(from[1], to[1]) > 1e-6;

  function model(): ValidSolid {
    let clip = single(
      outline
        .drawing()
        .translate(0, height)
        .sketchOnPlane('XZ', [0, plug.y / 2, 0])
        .extrude(plug.y),
    );
    if (c > 0) {
      const onProfile = (edge: Edge) => {
        const [, y, z] = curvePointAt(edge, 0.5);
        return Math.abs(Math.abs(y) - plug.y / 2) < 1e-6 && z > height + 1e-6;
      };
      clip = single(unwrap(chamfer(clip, edgeFinder().when(onProfile), c)));
    }
    return single(unwrap(fuse(key(height, plug), clip)));
  }

  // -------------------------------------------------------------------------
  // Declared intent, worked out apart from the outline
  // -------------------------------------------------------------------------

  // The hull of the bar's top edge and the outer circle, as for the flat lip.
  // Take away the wedge above the mouths' radii, out to the outer circle, and
  // the bore below it. Add each roll: it lies clear of the bore, so its half
  // above the mouth's radius is all new, and of the half below only what
  // bulges past the outer circle, half the roll less its overlap with the
  // outer disc (the two are symmetric about the line through their centres).
  // The blend fills the crease between the outer circle, the roll and itself:
  // its area by Green's theorem round those three arcs.
  const lens = circleOverlap(rollR, outerR, rollCentreR);
  const wedge = Math.PI - 2 * mouthAngle;
  const crease = blended
    ? Math.abs(
        new Outline(leave)
          .arcTo(centre, meet, 'ccw')
          .arcTo(roll, reach, 'ccw')
          .arcTo(blend, leave, 'ccw')
          .signedArea(),
      )
    : 0;
  const area =
    Math.PI * outerR ** 2 +
    2 * (outerR * halfBase - outerR ** 2 * beta) -
    (outerR ** 2 * wedge) / 2 -
    (Math.PI * boreR ** 2 - (boreR ** 2 * wedge) / 2) +
    2 * (Math.PI * rollR ** 2 - lens / 2 + crease);

  // The roll's outermost point, level with its centre, is on the outline when
  // the roll starts below that level; otherwise the outer circle's widest point
  // is, unless the circle stops short of level.
  const rollWidest = reach[1] < roll[1] ? roll[0] + rollR : reach[0];
  const outerWidest = leave[1] >= centreZ ? outerR : leave[0];
  const xMax = Math.max(rollWidest, outerWidest);

  const expected = {
    volume:
      keySectionArea(plug) * height + area * plug.y - 2 * outline.chamferVolume(c, aboveBase),
    bounds: {
      xMin: -xMax,
      xMax,
      yMin: -plug.y / 2,
      yMax: plug.y / 2,
      zMin: 0,
      zMax: height + roll[1] + rollR,
    },
    tolerancePct: 0.1,
  };

  /** Between the rolls, level with their centres. */
  const opening = 2 * (roll[0] - rollR);

  return { model, expected, opening };
}

/** Area common to two circles of radius `r1` and `r2`, their centres `d` apart. */
function circleOverlap(r1: number, r2: number, d: number): number {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const a1 = Math.acos(clamp((d ** 2 + r1 ** 2 - r2 ** 2) / (2 * d * r1)));
  const a2 = Math.acos(clamp((d ** 2 + r2 ** 2 - r1 ** 2) / (2 * d * r2)));
  const kite = Math.sqrt(Math.max(0, (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2)));
  return r1 ** 2 * a1 + r2 ** 2 * a2 - kite / 2;
}

/**
 * The compliant clip (./compliant-clip.ts) on the same bar. Its profile is
 * drawn whole, extruded the length of the key and joined to the bar, and the
 * slots between the bands are cut through it.
 */
function compliantDesign(params: Params, height: number, boreR: number): Built {
  const plug = plugFor(params.fitTolerance);

  const flex = compliantClip({
    boreRadius: boreR,
    poleRadius: params.poleDiameter / 2,
    snap: params.snap,
    band: params.bandThickness,
    hook: params.hookThickness,
    hookGap: params.hookGap,
    slot: params.slotWidth,
    hookEnd: params.hookEnd,
    slotEndRadius: params.slotEndRadius,
    halfBase: plug.x / 2,
  });

  /** A profile on the bar's top face, extruded along Y, `over` past both ends. */
  const prism = (outline: Outline, over: number) =>
    single(
      outline
        .drawing()
        .translate(0, height)
        .sketchOnPlane('XZ', [0, plug.y / 2 + over, 0])
        .extrude(plug.y + 2 * over),
    );

  /** The end-face chamfer: round the outline only, so each band is chamfered on one face. */
  const c = Math.min(params.edgeChamfer, params.bandThickness / 2);
  const aboveBase = (from: Point, to: Point) => Math.max(from[1], to[1]) > 1e-6;

  function model(): ValidSolid {
    let clip = prism(flex.outline, 0);

    // As for the rigid clip: on the clip alone, before it joins the bar, every
    // edge of both end faces except the base.
    if (c > 0) {
      const onProfile = (edge: Edge) => {
        const [, y, z] = curvePointAt(edge, 0.5);
        return Math.abs(Math.abs(y) - plug.y / 2) < 1e-6 && z > height + 1e-6;
      };
      clip = single(unwrap(chamfer(clip, edgeFinder().when(onProfile), c)));
    }

    let part = single(unwrap(fuse(key(height, plug), clip)));
    for (const slot of flex.slots) part = single(unwrap(cut(part, prism(slot, OVER))));
    return part;
  }

  const expected = {
    volume:
      keySectionArea(plug) * height +
      flex.area * plug.y -
      2 * flex.outline.chamferVolume(c, aboveBase),
    bounds: {
      xMin: -flex.outerR,
      xMax: flex.outerR,
      yMin: -plug.y / 2,
      yMax: plug.y / 2,
      zMin: 0,
      zMax: height + flex.top,
    },
    tolerancePct: 0.1,
  };

  return { model, expected, opening: flex.opening };
}

const standard = design();

export default function poleHolder(): ValidSolid {
  return standard.model();
}

export const { expected, opening } = standard;
