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
  cutoutDepth: 63.5,

  /**
   * Printed-fit slop, taken off each cutout dimension in total — 0.15 per side.
   * A plug is `cutoutWidth - fitTolerance` by `cutoutLength - fitTolerance`.
   */
  fitTolerance: 0.3,

  /** Clear gap between adjacent cutouts along a side: 11 in. */
  cutoutGap: 279.4,

  /** Across the cart, centre to centre between cutouts on opposite long sides. */
  cutoutSpanAcross: 655,
} as const;

/** Section of a plug that drops into a cutout, fit tolerance applied. */
export const plug = {
  x: cart.cutoutWidth - cart.fitTolerance, // 19.2
  y: cart.cutoutLength - cart.fitTolerance, // 51.0
} as const;
