/**
 * Closed 2D outlines of lines and circular arcs, for profiles drawn whole and
 * extruded: the pole tool holder's compliant clip (./compliant-clip.ts) and its
 * rigid clip with rolled edges (./pole-holder.brep.ts).
 *
 * Each arc is given by its centre and end points and the way it turns, so arcs
 * that meet tangentially join exactly, with no boolean between them. The same
 * outline gives the brepjs drawing, its area by Green's theorem, and the volume
 * an end-face chamfer takes from it.
 */
import { draw, type Drawing } from 'brepjs';

/** A point in a profile: X across the rim, Z up. */
export type Point = readonly [number, number];

export const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
export const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1]];
export const scale = (a: Point, k: number): Point => [a[0] * k, a[1] * k];
export const len = (a: Point): number => Math.hypot(a[0], a[1]);
export const unit = (a: Point): Point => scale(a, 1 / len(a));

type Segment =
  | { readonly kind: 'line'; readonly from: Point; readonly to: Point }
  | {
      readonly kind: 'arc';
      readonly from: Point;
      readonly to: Point;
      readonly centre: Point;
      readonly r: number;
      /** Start angle, standard: from +X toward +Z. */
      readonly a0: number;
      /** Signed sweep: positive counterclockwise. */
      readonly sweep: number;
    };

/** A closed outline of lines and circular arcs, drawn point to point. */
export class Outline {
  readonly start: Point;
  private readonly segments: Segment[] = [];
  private pointer: Point;

  constructor(start: Point) {
    this.start = start;
    this.pointer = start;
  }

  lineTo(to: Point): this {
    this.segments.push({ kind: 'line', from: this.pointer, to });
    this.pointer = to;
    return this;
  }

  /** An arc round `centre` from the pointer to `to`, which must be as far from the centre, turning counterclockwise or clockwise. */
  arcTo(centre: Point, to: Point, direction: 'ccw' | 'cw'): this {
    const r = len(sub(this.pointer, centre));
    if (Math.abs(len(sub(to, centre)) - r) > 1e-6) {
      throw new Error(`arc ends ${len(sub(to, centre))} from its centre, not ${r}`);
    }
    const a0 = Math.atan2(this.pointer[1] - centre[1], this.pointer[0] - centre[0]);
    const a1 = Math.atan2(to[1] - centre[1], to[0] - centre[0]);
    const turn = (((a1 - a0) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); // [0, 2π)
    const sweep = direction === 'ccw' ? turn : turn - 2 * Math.PI;
    if (Math.abs(sweep) < 1e-9 || Math.abs(Math.abs(sweep) - 2 * Math.PI) < 1e-9) {
      throw new Error('arc of no length, or a full circle');
    }
    this.segments.push({ kind: 'arc', from: this.pointer, to, centre, r, a0, sweep });
    this.pointer = to;
    return this;
  }

  /** Back to the start, with a line if the last segment didn't end there. */
  close(): this {
    if (len(sub(this.pointer, this.start)) > 1e-9) this.lineTo(this.start);
    return this;
  }

  /** Enclosed area by Green's theorem, ½∮(x dz − z dx): positive when it runs counterclockwise. */
  signedArea(): number {
    let twice = 0;
    for (const s of this.segments) {
      if (s.kind === 'line') {
        twice += s.from[0] * s.to[1] - s.to[0] * s.from[1];
      } else {
        const { centre: c, r, a0, sweep } = s;
        const a1 = a0 + sweep;
        twice +=
          r * r * sweep +
          c[0] * r * (Math.sin(a1) - Math.sin(a0)) -
          c[1] * r * (Math.cos(a1) - Math.cos(a0));
      }
    }
    return twice / 2;
  }

  /**
   * Volume a 45° chamfer of `c` takes from the edges of one end face of the
   * outline extruded, for the segments `include` picks: the c²/2 triangle swept
   * along each (Pappus). Round an arc the triangle's centroid sits c/3 inside
   * the edge: nearer the centre where the solid is inside the arc, as it is
   * where a counterclockwise outline turns counterclockwise, and further where
   * it is outside. Run counterclockwise. The mitres where the swept triangles
   * meet are left out.
   */
  chamferVolume(c: number, include: (from: Point, to: Point) => boolean): number {
    let length = 0;
    for (const s of this.segments) {
      if (!include(s.from, s.to)) continue;
      if (s.kind === 'line') length += len(sub(s.to, s.from));
      else length += Math.abs(s.sweep) * (s.r - (Math.sign(s.sweep) * c) / 3);
    }
    return (c ** 2 / 2) * length;
  }

  /** As a brepjs drawing, each arc through its midpoint. */
  drawing(): Drawing {
    let pen = draw([...this.start]);
    for (const s of this.segments) {
      if (s.kind === 'line') {
        pen = pen.lineTo([...s.to]);
      } else {
        const mid = s.a0 + s.sweep / 2;
        pen = pen.threePointsArcTo(
          [...s.to],
          [s.centre[0] + s.r * Math.cos(mid), s.centre[1] + s.r * Math.sin(mid)],
        );
      }
    }
    return pen.close();
  }
}
