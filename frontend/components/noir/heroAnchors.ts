/**
 * Featherweight anchor-mapping helpers shared by the EAGER hero wrapper and the
 * code-split WebGL renderer. Deliberately tiny and dependency-light (only the
 * fixed DEMO_BADGES array) so importing it from the first-load path does NOT
 * drag in the heavy geometry baker (buildHeroGeometry + all the bezier math),
 * which must stay inside the dynamic WebGL chunk.
 */
import { DEMO_BADGES } from "./artifactTreeData";

/** Anchor-index sentinel: a point that belongs to the core/branches, not a spoke. */
export const NO_ANCHOR = -1;

/** Stable mapping anchor-index → badge id, so the renderer can light a node's
 *  filament when its badge is hovered (uHover carries the anchor index). */
export const ANCHOR_IDS: string[] = DEMO_BADGES.map((b) => b.id);

export function anchorIndexFor(id: string | null | undefined): number {
  if (!id) return NO_ANCHOR;
  const i = ANCHOR_IDS.indexOf(id);
  return i >= 0 ? i : NO_ANCHOR;
}

/** Per-anchor reveal stage (indexed by anchor index), mirroring each badge's
 *  appearStage so staged demos reveal branches progressively in the shader. */
export const ANCHOR_STAGE: Float32Array = new Float32Array(
  DEMO_BADGES.map((b) => Math.max(2, b.appearStage)),
);
