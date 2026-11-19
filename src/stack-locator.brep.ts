/**
 * Stack locator.
 *
 * Registers one stacked accessory on another. Bolted to a side extension post,
 * the first accessory's key is located by the registration boss on the post.
 * A key has to fit the cart's cutout, so it can't carry a boss of its own for
 * the next key to locate on: both keys have pockets instead. The locator sits
 * between them, a boss for each pocket, back to back. The bolts pass through
 * it, so it stays put while the stack goes together. See ./stacking.ts.
 *
 * Laid flat to print: one boss's top face on the bed, the other's up. The
 * flanks are 45°, so neither half needs support.
 *
 * Units: millimetres. Z up from the bed. X along the bolt line (up the stack
 * once fitted), Y across it.
 */
import { rotate, translate, type ValidSolid } from 'brepjs';

import { type Schema } from './params.js';
import { registration, stackLocator, stackLocatorVolume } from './stacking.js';

/** Nothing to change: the locator is the boss itself, and the keys' pockets take the fit. */
export const defaults = {};
export const schema: Schema<typeof defaults> = {};

export function design() {
  function model(): ValidSolid {
    // Built about the plane where two keys meet, X through the stack. Turn that
    // to Z and lift it onto the bed.
    const flat = rotate(stackLocator(), 90, { axis: [0, 1, 0] });
    return translate(flat, [0, 0, registration.height]);
  }

  // -------------------------------------------------------------------------
  // Declared intent — asserted by `brep verify --check`
  // -------------------------------------------------------------------------

  const expected = {
    volume: stackLocatorVolume,
    bounds: {
      xMin: -registration.length / 2,
      xMax: registration.length / 2,
      yMin: -registration.width / 2,
      yMax: registration.width / 2,
      zMin: 0,
      zMax: 2 * registration.height,
    },
    tolerancePct: 0.1,
  };

  return { model, expected };
}

const standard = design();

export default function stackLocatorPart(): ValidSolid {
  return standard.model();
}

export const { expected } = standard;
