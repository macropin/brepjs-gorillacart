/**
 * Measured facts about the Gorilla Carts 200L poly dump cart, shared by every
 * accessory. See the "Cart cutout dimensions" table in the README.
 *
 * Units: millimetres.
 */

export const cart = {
  /**
   * Rim cutout, as measured. The long side (`cutoutLength`) runs along the rim,
   * the short side (`cutoutWidth`) across it.
   */
  cutoutLength: 51.3,
  cutoutWidth: 19.5,
  cutoutDepth: 63.5, // 2.5 in

  /**
   * Printed-fit slop, taken off each cutout dimension in total — 0.15 per side.
   * A plug is `cutoutWidth - fitTolerance` by `cutoutLength - fitTolerance`.
   */
  fitTolerance: 0.3,

  /** Clear gap between adjacent cutouts along a side: 11 in, edge to edge. */
  cutoutGap: 279.4,

  /** Across the cart, centre to centre between cutouts on opposite long sides. */
  cutoutSpanAcross: 656,

  /** Clear gap between the two handle-end cutouts. Measured: the same as along the sides. */
  handleEndGap: 279.4,

  /**
   * Clear gap along the cart between each handle-end cutout and the nearest
   * long-side cutout, edge to edge. The handle-end cutout runs across the cart
   * here, so its narrow side faces the long-side cutout's end.
   */
  cornerGap: 105,

  /**
   * The rim's top edge isn't flat. For `landingLength` past each end of every
   * cutout it is level with the cutout's mouth; between those landings, along
   * the rest of the rim, it sits `rimDrop` lower. Approximate.
   */
  landingLength: 20,
  rimDrop: 1.5,

  /**
   * The rim's outside edge, this far outside the line through the cutouts (4.4
   * mm past a key's outer face), and how far the rim hangs down there below its
   * top, as a lip. Below the lip the tub's wall tapers inward, well clear.
   * Approximate: read from Gorilla's product photos, not measured.
   */
  rimOutside: 14,
  rimLip: 25,
} as const;

/** Centre to centre between neighbouring cutouts along a side: 330.7. */
export const cutoutPitch = cart.cutoutGap + cart.cutoutLength;

/** Centre to centre between the two handle-end cutouts: 330.7. */
export const handleEndPitch = cart.handleEndGap + cart.cutoutLength;

/**
 * The two handle-end corners, each spanned by a corner panel from the long-side
 * cutout nearest the handle end to the handle-end cutout on that side.
 */
export const corner = {
  /** Across the cart: long-side cutout centre to handle-end cutout centre. */
  across: cart.cutoutSpanAcross / 2 - handleEndPitch / 2, // 162.65

  /**
   * Along the cart: handle-end cutout centre to long-side cutout centre. The
   * edge-to-edge gap plus half of each cutout along the cart: half the
   * handle-end cutout's width and half the long-side cutout's length.
   */
  along: cart.cornerGap + cart.cutoutWidth / 2 + cart.cutoutLength / 2, // 140.4
} as const;

/** Section of a plug that drops into a cutout: X across the rim, Y along it. */
export interface Plug {
  readonly x: number;
  readonly y: number;
}

/** The plug section with `fitTolerance` taken off each cutout dimension. */
export function plugFor(fitTolerance: number): Plug {
  return {
    x: cart.cutoutWidth - fitTolerance,
    y: cart.cutoutLength - fitTolerance,
  };
}

/** The plug section at the default fit tolerance: 19.2 × 51.0. */
export const plug = plugFor(cart.fitTolerance);
