/**
 * Parameters a user may change, for the online generator (web/).
 *
 * Each part module exports:
 *
 * - `defaults`: every dimension the part is built from, as printed from this
 *   repo.
 * - `schema`: which of those a user may change, and within what range. Every
 *   value in range should build a valid, printable part; `make sweep` checks
 *   each limit.
 * - `design(params)`: the part built from any set of parameters, returning its
 *   `model` and its declared intent, `expected`.
 *
 * Its default export is the part at its defaults, as the brep CLI expects.
 */

export interface ParamSpec {
  /** Field label, in sentence case. */
  readonly label: string;
  readonly unit: 'mm' | '°';
  readonly min: number;
  readonly max: number;
  readonly step: number;
  /** One line under the field. */
  readonly help?: string;
}

/** A part's parameters: the shape of its defaults, every value a number. */
export type Numeric<T> = { readonly [K in keyof T]: number };

/** The parameters of `P` that a user may change, each with its range. */
export type Schema<P> = { readonly [K in keyof P]?: ParamSpec };

/** The printed-fit slop. Every part that plugs into a cutout or a groove takes it. */
export const fitToleranceSpec: ParamSpec = {
  label: 'Fit tolerance',
  unit: 'mm',
  min: 0,
  max: 1,
  step: 0.05,
  help: 'Clearance taken off each fit in total. Raise it if parts print tight.',
};

/** A parameter combination that would build an unprintable or broken part. */
export class DesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignError';
  }
}

/** Throws a `DesignError` unless `value` is at least `min`. */
export function atLeast(what: string, value: number, min: number): void {
  if (!(value >= min - 1e-9)) {
    throw new DesignError(`${what} would be ${round(value)} mm, under the ${min} mm minimum`);
  }
}

const round = (v: number) => Math.round(v * 100) / 100;
