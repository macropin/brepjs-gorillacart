/**
 * Compliant snap clip, for the pole tool holder (./pole-holder.brep.ts).
 *
 * A pole is held by two hooks that wrap it from either side. Each hook hangs
 * from a rounded head at its top and is otherwise free: the head is carried on
 * two thin curved bands, one inside the other, that run down round the outside
 * of the hook to the base. Pushing a pole down between the heads presses them
 * apart. The bands flex and the head and hook swing outward as one, so the
 * strain is spread along the bands instead of gathered at a hinge, which suits
 * PETG. Once the pole is past the heads the bands spring back and the hooks
 * close round it.
 *
 * The shape follows a clip whose STL was supplied as a reference. Everything
 * is built round the pole's centre, and seen end on it is a set of concentric
 * rings, from the inside out:
 *
 *   bore      R            the hook's inner face, where the pole sits
 *   hook      R .. R+h     rigid, ending in a round tip
 *   gap       .. +g        room for the hook to swing out
 *   band      .. +t        inner band
 *   slot      .. +s        between the bands, closed at both ends
 *   band      .. +t        outer band, the clip's outside
 *
 * The rings stop at the head angle either side of the top, where a disc spans
 * all of them and rounds them off: the head. Its throat-side half is solid,
 * with the end of the gap rounded off inside it, and the slot curls over the
 * gap's end inside the head to a round end, so the outer band runs over the
 * top of the head to the hook's root and the inner band wraps the gap's end to
 * meet it there. Every wall the curl leaves is a band thick. The reference
 * clip measures R 8, h 4, g 5, t 2, s 3, with the heads 55° either side of
 * the top and the hook tips 150° round from it; its two halves are drawn round
 * centres 1.5 mm apart, which this one closes up.
 *
 * Below the rings the clip widens to the bar: its outline is the convex hull of
 * the bar's top edge and the outermost ring, as the rigid clip's is. The slot
 * stops where the hull leaves the ring, so the outer band thickens smoothly
 * into the base; the gap carries on round the bottom of the pocket under the
 * pole, and the inner band with it, into the base.
 *
 * Profile coordinates: X across the rim, Z up from the bar's top face at 0.
 * Angles round the pole are measured from straight up, outward to either side.
 */
import { atLeast, DesignError } from './params.js';
import { add, len, Outline, scale, sub, unit, type Point } from './outline.js';

// ---------------------------------------------------------------------------
// The clip
// ---------------------------------------------------------------------------

export interface CompliantClipSpec {
  /** The bore: the pole's radius plus half the fit tolerance. */
  readonly boreRadius: number;
  /** The pole's own radius, which the opening is measured against. */
  readonly poleRadius: number;
  /** How much narrower than the pole the opening between the heads is. Each hook swings out half of it. */
  readonly snap: number;
  /** Thickness of each band, and of every wall in the head. */
  readonly band: number;
  /** Thickness of the hook. */
  readonly hook: number;
  /** Clear gap between the hook and the inner band. */
  readonly hookGap: number;
  /** Width of the slot between the bands. */
  readonly slot: number;
  /** Where the hook's tip ends, in degrees round from the top of the bore. */
  readonly hookEnd: number;
  /** Radius of the round at the slot's end inside the head. */
  readonly slotEndRadius: number;
  /** Half the width of the bar's top face, which the clip stands on. */
  readonly halfBase: number;
}

export function compliantClip(spec: CompliantClipSpec) {
  const { band: t, hook: h, hookGap: g, slot: s, halfBase: a } = spec;
  const R = spec.boreRadius;

  /** The rings' radii, inside out. */
  const hookOuter = R + h;
  const pocketR = hookOuter + g; // inner band's inner face
  const slotInner = pocketR + t;
  const slotOuter = slotInner + s;
  const outerR = slotOuter + t;

  /** The head: a disc spanning every ring, so as wide as the rings together, centred on their middle. */
  const headR = (outerR - R) / 2;
  const headCentreR = R + headR;

  /** The gap's round end, centred in the gap, and the slot's curl round it, a band clear of it. */
  const gapEndR = hookOuter + g / 2;

  /** The pole's centre: the outermost ring sits on the bar's top face, as the rigid clip's circle does. */
  const centreZ = outerR;

  // The head angle: where the throat between the heads is `snap` narrower than
  // the pole. The heads' innermost points are headCentreR·sin(φ) − headR out
  // from the middle.
  const throatHalf = spec.poleRadius - spec.snap / 2;
  const sinHead = (throatHalf + headR) / headCentreR;
  if (!(throatHalf > 0)) {
    throw new DesignError('The snap would close the opening between the heads');
  }
  if (!(sinHead < 1)) {
    throw new DesignError('The snap must leave the opening narrower than the bore');
  }
  const headAngle = Math.asin(sinHead);
  const tipAngle = (spec.hookEnd * Math.PI) / 180;

  /** Where the hull's side line from the bar's top corner meets the outermost ring. */
  const hullAngle = Math.PI - 2 * Math.atan(a / outerR);

  if (!(tipAngle - headAngle >= Math.PI / 4)) {
    throw new DesignError('The hooks would wrap less than 45° of the pole: make the snap deeper');
  }
  if (!(hullAngle - headAngle >= Math.PI / 4)) {
    throw new DesignError('The bands would be too short to flex');
  }
  // The hook tips, a hook thick, must stay clear of each other under the pole.
  atLeast('The gap between the hook tips', 2 * (R + h / 2) * Math.sin(tipAngle) - h, 2);

  /** A point `r` from the pole's centre, `phi` round from the top, on the right (+1) or left (−1). */
  const at = (side: 1 | -1, r: number, phi: number): Point => [
    side * r * Math.sin(phi),
    centreZ + r * Math.cos(phi),
  ];
  const centre: Point = [0, centreZ];

  /**
   * Both ends of the slot's curl inside the head, on one side: its round end's
   * centre, sitting a band in from the head's outside and a band clear of the
   * gap's end, and where that round meets each.
   */
  function slotEnd(side: 1 | -1) {
    const headC = at(side, headCentreR, headAngle);
    const gapC = at(side, gapEndR, headAngle);
    const c = spec.slotEndRadius;
    const toHead = headR - t - c; // from the head's centre
    const toGap = g / 2 + t + c; // from the gap end's centre

    // Along the head's radial line (u, outward) and square to it toward the
    // throat (v): the head's centre is at u = headCentreR, the gap end's at gapEndR.
    const d = headCentreR - gapEndR;
    if (!(Math.abs(d) > 1e-6)) throw new DesignError('The slot has no room to curl inside the head');
    const u = ((toGap ** 2 - toHead ** 2) / d + headCentreR + gapEndR) / 2;
    const v2 = toHead ** 2 - (u - headCentreR) ** 2;
    if (!(v2 > 0)) throw new DesignError('The slot has no room to curl inside the head');
    const v = Math.sqrt(v2);
    const radial: Point = [side * Math.sin(headAngle), Math.cos(headAngle)];
    const towardThroat: Point = [-side * Math.cos(headAngle), Math.sin(headAngle)];
    const endC = add(add(centre, scale(radial, u)), scale(towardThroat, v));
    return {
      headC,
      gapC,
      endC,
      onHead: add(headC, scale(unit(sub(endC, headC)), headR - t)),
      onGap: add(gapC, scale(unit(sub(endC, gapC)), g / 2 + t)),
    };
  }

  // The outline, counterclockwise from the bar's left top corner. On the right
  // side, going up is counterclockwise round the pole's centre; on the left it
  // is clockwise. Faces with the solid outside the arc (the bore, the gap's
  // ends, the pocket) turn the other way from those with it inside.
  const outline = new Outline([-a, 0]).lineTo([a, 0]).lineTo(at(1, outerR, hullAngle));
  for (const side of [1, -1] as const) {
    const up = side === 1 ? 'ccw' : 'cw';
    const down = side === 1 ? 'cw' : 'ccw';
    const headC = at(side, headCentreR, headAngle);
    const gapC = at(side, gapEndR, headAngle);
    const tipC = at(side, R + h / 2, tipAngle);
    if (side === 1) {
      outline
        .arcTo(centre, at(1, outerR, headAngle), up) // outer band, up to the head
        .arcTo(headC, at(1, R, headAngle), 'ccw') // over the head to the throat
        .arcTo(centre, at(1, R, tipAngle), down) // hook's inner face
        .arcTo(tipC, at(1, hookOuter, tipAngle), 'ccw') // hook tip
        .arcTo(centre, at(1, hookOuter, headAngle), up) // hook's outer face
        .arcTo(gapC, at(1, pocketR, headAngle), 'cw') // gap's end
        .arcTo(centre, at(-1, pocketR, headAngle), 'cw'); // inner band, round the bottom
    } else {
      outline
        .arcTo(gapC, at(-1, hookOuter, headAngle), 'cw') // gap's end
        .arcTo(centre, at(-1, hookOuter, tipAngle), down) // hook's outer face
        .arcTo(tipC, at(-1, R, tipAngle), 'ccw') // hook tip
        .arcTo(centre, at(-1, R, headAngle), up) // hook's inner face
        .arcTo(headC, at(-1, outerR, headAngle), 'ccw') // over the head
        .arcTo(centre, at(-1, outerR, hullAngle), down); // outer band, down to the hull
    }
  }
  outline.close(); // the hull's left side line, back to the bar's corner

  /** The slot on one side, from its bottom end up and round its curl in the head, and back. */
  function slotOutline(side: 1 | -1): Outline {
    const up = side === 1 ? 'ccw' : 'cw';
    const down = side === 1 ? 'cw' : 'ccw';
    const turn = side === 1 ? 'ccw' : 'cw'; // round a convex end, as the slot runs
    const back = side === 1 ? 'cw' : 'ccw';
    const end = slotEnd(side);
    return new Outline(at(side, slotOuter, hullAngle))
      .arcTo(centre, at(side, slotOuter, headAngle), up)
      .arcTo(end.headC, end.onHead, turn)
      .arcTo(end.endC, end.onGap, turn)
      .arcTo(end.gapC, at(side, slotInner, headAngle), back)
      .arcTo(centre, at(side, slotInner, hullAngle), down)
      .arcTo(at(side, slotInner + s / 2, hullAngle), at(side, slotOuter, hullAngle), turn)
      .close();
  }
  const slots = [slotOutline(1), slotOutline(-1)] as const;

  // -------------------------------------------------------------------------
  // Declared intent, worked out apart from the outlines above
  // -------------------------------------------------------------------------

  // The hull of the bar's top edge and the outermost ring: the ring, plus a
  // kite either side less the sector it spans. Take away the ring's sector
  // between the heads, and add back each head's throat-side half. Take away
  // the pocket: the disc out to the inner band, but for its sector between the
  // heads, already gone. Add back the hooks, each a ring sector and a half-disc
  // tip, and take away the throat-side half of each gap end. Last, the slots.
  const beta = Math.atan(a / outerR);
  const hull = Math.PI * outerR ** 2 + 2 * (outerR * a - outerR ** 2 * beta);
  const hookArea = ((hookOuter ** 2 - R ** 2) / 2) * (tipAngle - headAngle) + (Math.PI * h ** 2) / 8;

  // Each slot: a ring sector, a half-disc at its bottom end, and the curl. The
  // curl lies inside the head's inner circle and outside the gap end's: its
  // area, by Green's theorem, round the radial line, the two circles and the
  // round at its end.
  const end = slotEnd(1);
  const curl = new Outline(at(1, slotInner, headAngle))
    .lineTo(at(1, slotOuter, headAngle))
    .arcTo(end.headC, end.onHead, 'ccw')
    .arcTo(end.endC, end.onGap, 'ccw')
    .arcTo(end.gapC, at(1, slotInner, headAngle), 'cw');
  const slotArea =
    ((slotOuter ** 2 - slotInner ** 2) / 2) * (hullAngle - headAngle) +
    (Math.PI * s ** 2) / 8 +
    Math.abs(curl.signedArea());

  const area =
    hull -
    outerR ** 2 * headAngle +
    Math.PI * headR ** 2 -
    pocketR ** 2 * (Math.PI - headAngle) +
    2 * hookArea -
    (2 * Math.PI * g ** 2) / 8 -
    2 * slotArea;

  /** The heads' tops: the highest point of the clip. */
  const top = centreZ + headCentreR * Math.cos(headAngle) + headR;

  return {
    outline,
    slots,
    area,
    centreZ,
    outerR,
    top,
    /** The opening between the heads. */
    opening: 2 * throatHalf,
    headAngle,
    hullAngle,
    radii: { R, hookOuter, pocketR, slotInner, slotOuter, outerR, headR },
  };
}
