/**
 * The pole tool holder with its rigid clip, rolled lips and all, and
 * everything else at the defaults, so `make verify`, `make render` and
 * `make export` cover it as they do the compliant one. It is
 * ./pole-holder.brep.ts with `clip` set to rigid, as the STL generator builds it.
 */
import type { ValidSolid } from 'brepjs';

import { CLIPS, defaults, design } from './pole-holder.brep.js';

const rigid = design({ ...defaults, clip: CLIPS.rigid });

export default function poleHolderRigid(): ValidSolid {
  return rigid.model();
}

export const { expected, opening } = rigid;
