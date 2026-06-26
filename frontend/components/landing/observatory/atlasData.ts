/**
 * Constellan, Memory Observatory star-atlas data.
 *
 * The homepage centerpiece is a precision celestial chart (not a glowing neural
 * blob): the agent's memory rendered as a sparse constellation. Each star is a
 * memory node / pipeline concept; thin constellation lines connect them into one
 * deliberate figure ("the Memoria constellation"). One star, the tainted
 * memory, collapses and goes dark (the threat the sentinel watches for).
 *
 * Coordinates live in a normalized chart space (x,y in [0,1], origin top-left)
 * and are FIXED, the chart is fully deterministic so it renders identically on
 * server and client (no hydration drift) and reads like a real engraved atlas.
 * `mag` is stellar magnitude shorthand: lower = brighter/larger (as in real
 * astronomy). Labels are cartographic and map to the product's concepts.
 */

export interface AtlasStar {
  /** Stable id, used for the constellation edge list. */
  id: string;
  /** Normalized chart position, [0,1]. */
  x: number;
  y: number;
  /** Magnitude: 0 = brightest/largest core, ~5 = faint field star. */
  mag: number;
  /** Catalogue label (mono) shown beside primary stars. */
  label: string;
  /** Designation under the name, the product concept it maps to. */
  des: string;
  /** The tainted memory, rendered collapsing/dark, the constellation's threat. */
  tainted?: boolean;
  /** Anchor side for the label so text never collides with the figure. */
  side: "left" | "right";
}

/**
 * The "Memoria" constellation, the named, labelled stars that form the figure.
 * Hand-placed into a deliberate, sparse shape that reads as an intentional
 * star-sign, not a random scatter. The tainted node (mem_poison_047) sits off
 * the main spine, where the firewall severs it.
 */
export const CONSTELLATION: AtlasStar[] = [
  { id: "core", x: 0.52, y: 0.47, mag: 0, label: "CORE", des: "agent memory", side: "right" },
  { id: "query", x: 0.31, y: 0.35, mag: 1.4, label: "QUERY_PATHS", des: "HydraDB graph", side: "left" },
  { id: "policy", x: 0.71, y: 0.27, mag: 1.8, label: "POLICY", des: "approval rule", side: "right" },
  { id: "replay", x: 0.19, y: 0.59, mag: 2.1, label: "REPLAY", des: "behavior diff", side: "left" },
  { id: "firewall", x: 0.67, y: 0.63, mag: 1.9, label: "FIREWALL", des: "MCP gateway", side: "right" },
  { id: "skill", x: 0.45, y: 0.74, mag: 2.4, label: "SKILLMAKE", des: "skill verifier", side: "left" },
  { id: "report", x: 0.83, y: 0.47, mag: 2.6, label: "EVIDENCE", des: "signed report", side: "right" },
  { id: "taint", x: 0.39, y: 0.19, mag: 1.2, label: "MEM_POISON_047", des: "tainted path", tainted: true, side: "left" },
];

/**
 * Constellation lines, the thin figure connecting the named stars. The tainted
 * star's link to the spine (`taint -> query`) is the path the firewall severs;
 * it is drawn dashed and dimmed (the collapsing limb). All others are the solid
 * silver figure.
 */
export const CONSTELLATION_LINES: {
  from: string;
  to: string;
  tainted?: boolean;
}[] = [
  { from: "query", to: "core" },
  { from: "policy", to: "core" },
  { from: "core", to: "firewall" },
  { from: "core", to: "report" },
  { from: "replay", to: "query" },
  { from: "skill", to: "firewall" },
  { from: "replay", to: "skill" },
  { from: "taint", to: "query", tainted: true },
];

/**
 * Deterministic field of faint background stars (the void's depth). Generated
 * from a tiny seeded PRNG so it is identical every render, no Math.random, no
 * hydration mismatch. Kept sparse and dim; the figure above must dominate.
 */
export interface FieldStar {
  x: number;
  y: number;
  mag: number;
  /** Phase offset [0,1) so twinkle is desynchronised across the field. */
  ph: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildFieldStars(count = 90): FieldStar[] {
  const rnd = mulberry32(0x14072438); // RA 14h02m · DEC +38° → the chart's seed
  const stars: FieldStar[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rnd(),
      y: rnd(),
      mag: 2.6 + rnd() * 2.6, // all faint field stars
      ph: rnd(),
    });
  }
  return stars;
}

/**
 * Ignition order for the "First Light" boot sequence, the order in which the
 * named stars light up. The core ignites first (the agent memory waking), then
 * the figure fills out from brightest to faintest, and the tainted star ignites
 * LAST so its collapse reads as the climax of the reveal. Returns the star's
 * normalized position in the sequence, [0..1].
 */
const IGNITE_SEQUENCE: string[] = [
  "core",
  "query",
  "policy",
  "firewall",
  "replay",
  "report",
  "skill",
  "taint",
];
const IGNITE_INDEX = new Map<string, number>(
  IGNITE_SEQUENCE.map((id, i) => [id, i]),
);

/** A star's [0..1] position in the ignition sequence (0 = first to light). */
export function igniteOrder(id: string): number {
  const i = IGNITE_INDEX.get(id) ?? 0;
  return IGNITE_SEQUENCE.length > 1 ? i / (IGNITE_SEQUENCE.length - 1) : 0;
}

/** Right-margin cartographic coordinate readouts (pure flavour, fixed). */
export const COORD_TICKS = [
  "RA 14h 02m",
  "DEC +38° 24′",
  "EPOCH J2026.0",
  "MAG LIMIT 6.2",
] as const;
