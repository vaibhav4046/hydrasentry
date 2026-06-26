/**
 * "First Light", the cinematic boot timeline for the Memory Observatory star
 * chart. A film-title-sequence reveal: the engraved plate frame draws in, the
 * azimuth ring sweeps on, RA/Dec ticks tick in, the named stars ignite one by
 * one (with a brief diffraction flash on the brighter ones), the constellation
 * lines draw along their length, and finally the tainted limb lights and the
 * extinction star collapses, after which the chart settles into its calm idle
 * (drift, sparse twinkle, sentinel sweep).
 *
 * This module is pure math (no canvas, no React): it maps elapsed seconds to a
 * set of [0..1] progress values the StarChart renderer consumes. Keeping the
 * timeline here keeps StarChart.tsx focused on drawing and well under the file
 * budget. Everything is deterministic given `t`, so reduced-motion can simply
 * request the final frame (phase = 1 everywhere).
 */

/** Cubic-bezier-ish eases as plain functions (no allocation per frame). */
export const easeOutExpo = (x: number): number =>
  x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
export const easeOutCubic = (x: number): number => 1 - Math.pow(1 - x, 3);
export const easeInOutCubic = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** Clamp to [0,1]. */
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Linear ramp over [start, start+dur] → [0,1], then eased. */
function ramp(t: number, start: number, dur: number): number {
  return clamp01((t - start) / dur);
}

/**
 * The boot timeline (seconds). Tuned so the whole sequence reads as ~2.6s of
 * deliberate, eased reveal and then hands off to the idle loop. Each phase is a
 * named [0..1] progress value.
 */
export const FIRST_LIGHT_DURATION = 2.85;

export interface FirstLightPhases {
  /** Plate frame: corner registration ticks draw in. */
  frame: number;
  /** Outer azimuth ring sweeps on (arc grows 0 → 2π). */
  ring: number;
  /** Inner ring + crosshair fade. */
  innerRing: number;
  /** Radial azimuth ticks tick in around the ring. */
  ticks: number;
  /** Faint star field fades up. */
  field: number;
  /** Named-star ignition front (0 → 1 across the ordered star list). */
  ignite: number;
  /** Constellation lines draw along their length. */
  lines: number;
  /** Tainted limb lights + extinction star collapses. */
  collapse: number;
  /** Sentinel sweep fades in (and from here the idle loop owns it). */
  sweep: number;
  /** Whole-sequence completion (drives a subtle settle of the plot). */
  done: number;
}

/** Map elapsed seconds since first paint to the phase progress values. */
export function firstLightPhases(t: number): FirstLightPhases {
  return {
    frame: easeOutCubic(ramp(t, 0.05, 0.45)),
    ring: easeOutExpo(ramp(t, 0.2, 0.85)),
    innerRing: easeOutCubic(ramp(t, 0.55, 0.6)),
    ticks: easeOutCubic(ramp(t, 0.6, 0.7)),
    field: easeOutCubic(ramp(t, 0.85, 0.9)),
    ignite: easeOutCubic(ramp(t, 1.0, 1.05)),
    lines: easeInOutCubic(ramp(t, 1.5, 0.85)),
    collapse: easeOutCubic(ramp(t, 2.25, 0.6)),
    sweep: easeOutCubic(ramp(t, 2.45, 0.4)),
    done: easeOutCubic(ramp(t, 0.05, FIRST_LIGHT_DURATION - 0.05)),
  };
}

/** The "all settled" frame (reduced-motion / poster). */
export const FIRST_LIGHT_FINAL: FirstLightPhases = {
  frame: 1,
  ring: 1,
  innerRing: 1,
  ticks: 1,
  field: 1,
  ignite: 1,
  lines: 1,
  collapse: 1,
  sweep: 1,
  done: 1,
};

/**
 * Per-star ignition: given the ignition front [0..1] and a star's order in the
 * sequence [0..1], return that star's own [0..1] reveal with a short flash
 * envelope. The flash is the brief over-bright diffraction spike as a star
 * "lights"; `flash` peaks at ignition and decays.
 */
export function starIgnition(
  front: number,
  order: number,
): { reveal: number; flash: number } {
  // Each star reveals over a window once the front passes its order.
  const span = 0.26; // how long one star takes to come up, in front-units
  const local = clamp01((front - order * (1 - span)) / span);
  const reveal = easeOutCubic(local);
  // Flash: a quick triangular pop near the moment of ignition (local ~0.18).
  const fp = clamp01(1 - Math.abs(local - 0.18) / 0.18);
  const flash = Math.pow(fp, 1.5) * (1 - clamp01((front - 0.999) * 1000)); // gone once fully booted
  return { reveal, flash };
}
