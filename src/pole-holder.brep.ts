/**
 * Pole tool holder.
 *
 * Carries a long-handled tool along the rim, in a pair of holders in
 * neighbouring cutouts. The key bar drops into a rim cutout and carries a
 * U-shaped clip on its top face. The clip's side profile is the convex hull of
 * the bar's top edge and a circle around the pole, cut flat a little above the
 * pole centre so the opening is narrower than the bore and the pole snaps in.
 * It is extruded the full 51mm along Y, and the pole lies along the rim.
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
import { key, keySectionArea } from './key.js';
import { atLeast, DesignError, fitToleranceSpec, type Numeric, type Schema } from './params.js';
import { single } from './solid.js';

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export const defaults = {
  /** Length of bar sunk into the cutout. */
  insertDepth: cart.cutoutDepth,

  /** Bar above the rim, under the clip. */
  standHeight: 50,

  /** Outside diameter of the tool pole. The bore adds the fit tolerance. */
  poleDiameter: 25.3,

  /** Clip wall around the bore, and the floor under it. */
  wall: 3,

  /**
   * Height of the flat top cut above the bore centre. Anything above zero
   * leaves the opening narrower than the bore, which is what retains the pole.
   */
  lipHeight: 4,

  /**
   * Breaks every edge of the clip's two end faces, outer profile and bore mouth
   * alike, so the pole and hands meet no sharp edge. The base of the clip, where
   * it meets the bar, is left square.
   */
  edgeChamfer: 1,

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
  lipHeight: {
    label: 'Snap lip height',
    unit: 'mm',
    min: 1,
    max: 7,
    step: 0.5,
    help: 'Flat top above the pole centre. Higher narrows the opening and grips tighter.',
  },
  wall: {
    label: 'Clip wall',
    unit: 'mm',
    min: 2,
    max: 6,
    step: 0.5,
    help: 'Thicker is stiffer, and harder to snap the pole into.',
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

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export function design(params: Params = defaults) {
  const plug = plugFor(params.fitTolerance);

  const rim = params.insertDepth; // 63.5

  /** Bar height: 63.5 + 50 = 113.5. */
  const height = rim + params.standHeight;

  const boreR = (params.poleDiameter + params.fitTolerance) / 2; // 12.8
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

const standard = design();

export default function poleHolder(): ValidSolid {
  return standard.model();
}

export const { expected, opening, lipWidth } = standard;
