/**
 * Deterministic geometry + node data for ArtifactTreeGraph.
 *
 * Everything here is computed from FIXED arrays or a SEEDED PRNG (mulberry32) so
 * SSR and client render byte-identical markup, no Math.random / Date at module
 * or render scope, no hydration mismatch. The tree is elegant WHITE LINEWORK
 * (branch <path> strokes) plus scattered glowing node-dots, echoing HydraDB's
 * voxel tree without its orange heat-map. All "danger" is intensity, never hue.
 *
 * Coordinate space: a 1000 x 720 viewBox. Trunk rises from bottom-center
 * (~500,690) into a canopy; labelled context-node badges sit in left/right
 * columns and connect back to the canopy with thin edges. The TAINTED PATH
 * (memory -> conflict -> risk -> firewall) is the dramatic chain.
 */
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Box,
  Brain,
  Code2,
  File,
  FileText,
  GitFork,
  Share2,
  ShieldAlert,
  User,
  Wrench,
} from "lucide-react";

export const VB_W = 1000;
export const VB_H = 720;

// Canopy focal point the trunk grows toward (branch + node edges converge here).
export const TREE_BASE = { x: 500, y: 690 };
export const CANOPY = { x: 500, y: 250 };

// ---- deterministic PRNG (mulberry32) ---------------------------------------
// Same generator the existing MemoryTree uses; tiny, fast, fully deterministic.
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

// ---- branch skeleton --------------------------------------------------------
// Hand-authored limbs as cubic beziers, trunk -> canopy, splaying up/out. Each
// renders as a thin white stroke that "draws in" via pathLength at stage >= 1.
export interface Branch {
  /** SVG path data (cubic bezier). */
  d: string;
  /** Stroke width at full intensity. */
  width: number;
  /** Base brightness 0..1 (outer twigs dimmer). */
  bright: number;
  /** Draw order, lower = nearer the trunk / earlier. */
  order: number;
}

export const BRANCHES: Branch[] = [
  // trunk (thick, bright), bottom-center rising to the canopy core
  { d: "M500 690 C 498 600, 502 470, 500 360", width: 3.6, bright: 1, order: 0 },
  // primary fork, left
  { d: "M500 410 C 470 360, 420 330, 372 300", width: 2.6, bright: 0.96, order: 1 },
  // primary fork, right
  { d: "M500 410 C 532 358, 584 330, 632 300", width: 2.6, bright: 0.96, order: 1 },
  // primary fork, up-left
  { d: "M500 380 C 484 320, 452 280, 430 232", width: 2.3, bright: 0.9, order: 1 },
  // primary fork, up-right
  { d: "M500 380 C 518 320, 552 282, 576 234", width: 2.3, bright: 0.9, order: 1 },
  // secondary, left canopy
  { d: "M372 300 C 332 276, 300 250, 276 214", width: 1.7, bright: 0.74, order: 2 },
  { d: "M372 300 C 360 256, 348 224, 342 188", width: 1.6, bright: 0.7, order: 2 },
  { d: "M430 232 C 410 196, 396 168, 392 138", width: 1.5, bright: 0.68, order: 2 },
  // secondary, right canopy
  { d: "M632 300 C 672 276, 706 252, 730 216", width: 1.7, bright: 0.74, order: 2 },
  { d: "M632 300 C 644 258, 658 226, 666 190", width: 1.6, bright: 0.7, order: 2 },
  { d: "M576 234 C 596 198, 612 170, 618 140", width: 1.5, bright: 0.68, order: 2 },
  { d: "M500 360 C 496 320, 500 296, 500 268", width: 1.4, bright: 0.82, order: 2 },
  // tertiary sub-twigs off the secondaries, richer canopy (left)
  { d: "M300 250 C 286 232, 278 220, 268 206", width: 1.0, bright: 0.52, order: 3 },
  { d: "M348 224 C 336 208, 330 198, 320 184", width: 1.0, bright: 0.52, order: 3 },
  { d: "M396 168 C 384 152, 378 142, 370 130", width: 0.95, bright: 0.5, order: 3 },
  // tertiary sub-twigs (right)
  { d: "M706 252 C 720 234, 728 222, 738 208", width: 1.0, bright: 0.52, order: 3 },
  { d: "M658 226 C 670 210, 676 200, 686 186", width: 1.0, bright: 0.52, order: 3 },
  { d: "M612 170 C 624 154, 630 144, 638 132", width: 0.95, bright: 0.5, order: 3 },
  // fine twigs (sparse embers at the tips)
  { d: "M276 214 C 256 190, 244 174, 236 150", width: 0.85, bright: 0.46, order: 4 },
  { d: "M342 188 C 332 164, 326 148, 324 126", width: 0.85, bright: 0.46, order: 4 },
  { d: "M730 216 C 750 192, 762 176, 770 152", width: 0.85, bright: 0.46, order: 4 },
  { d: "M666 190 C 676 166, 682 150, 684 128", width: 0.85, bright: 0.46, order: 4 },
  { d: "M392 138 C 384 120, 380 110, 378 96", width: 0.75, bright: 0.4, order: 4 },
  { d: "M618 140 C 626 122, 630 112, 632 98", width: 0.75, bright: 0.4, order: 4 },
];

// A clean "query path" that glows through the safe branches at stage >= 3.
// Trunk -> right primary fork -> right canopy twig (a legible retrieval route).
export const QUERY_PATH_D = "M500 690 C 498 560, 502 470, 500 410 C 532 358, 584 330, 632 300 C 672 276, 706 252, 730 216";

// ---- particles (glowing node-dots scattered along the branches) ------------
export interface Particle {
  x: number;
  y: number;
  r: number;
  bright: number;
  /** Twinkle phase 0..1 for staggered breathing. */
  phase: number;
}

/**
 * Sample dots along each branch with seeded jitter, dense near the trunk,
 * sparse toward the tips. Pure function of the fixed seed; identical every run.
 */
function buildParticles(): Particle[] {
  const rng = mulberry32(0x4ad7);
  const out: Particle[] = [];
  // Cheap bezier sampler, enough fidelity for dot placement.
  for (const b of BRANCHES) {
    const pts = parsePathPoints(b.d);
    if (!pts) continue;
    const density =
      b.order === 0 ? 16 : b.order === 1 ? 10 : b.order === 2 ? 7 : b.order === 3 ? 4 : 2;
    for (let i = 0; i < density; i++) {
      const t = (i + 0.5) / density;
      const p = cubicAt(pts, t);
      // jitter laterally a touch so dots scatter like embers, not a ruler line
      const jx = (rng() - 0.5) * (8 - b.order * 1.5);
      const jy = (rng() - 0.5) * (8 - b.order * 1.5);
      // skip some outer dots so tips thin out
      if (b.order >= 2 && rng() < 0.25) continue;
      out.push({
        x: p.x + jx,
        y: p.y + jy,
        r: 0.9 + rng() * (b.order === 0 ? 1.6 : 1.0),
        bright: Math.max(0.2, b.bright * (0.7 + rng() * 0.45)),
        phase: rng(),
      });
    }
  }
  return out;
}

// minimal "M x y C x1 y1, x2 y2, x y" parser -> 4 control points
interface Pt {
  x: number;
  y: number;
}
function parsePathPoints(d: string): [Pt, Pt, Pt, Pt] | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums || nums.length < 8) return null;
  return [
    { x: nums[0], y: nums[1] },
    { x: nums[2], y: nums[3] },
    { x: nums[4], y: nums[5] },
    { x: nums[6], y: nums[7] },
  ];
}
function cubicAt(p: [Pt, Pt, Pt, Pt], t: number): Pt {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const e = t * t * t;
  return {
    x: a * p[0].x + b * p[1].x + c * p[2].x + e * p[3].x,
    y: a * p[0].y + b * p[1].y + c * p[2].y + e * p[3].y,
  };
}

export const PARTICLES: Particle[] = buildParticles();

// ---- labelled context-node badges ------------------------------------------
export type BadgeColumn = "top" | "left" | "right";

export interface DemoBadge {
  id: string;
  title: string;
  sub: string;
  Icon: LucideIcon;
  /** Badge center in viewBox space. */
  x: number;
  y: number;
  column: BadgeColumn;
  /** On the tainted chain -> white-hot + pulse. */
  tainted: boolean;
  /** Stage at which this node fades in. */
  appearStage: number;
  /** Inspector metadata (for NodeInspectorPreview on click). */
  type: string;
  sourceChunkId?: string;
  tenant?: string;
  subTenant?: string;
  relevancy?: number;
  status?: string;
  riskReason?: string;
}

// Left column x, right column x, vertical rhythm. Badges connect to the canopy.
const LX = 150;
const RX = 850;

export const DEMO_BADGES: DemoBadge[] = [
  // TOP center, the task that kicks everything off
  {
    id: "user_task",
    title: "USER TASK",
    sub: "Process refund for VIP customer",
    Icon: User,
    x: 500,
    y: 70,
    column: "top",
    tainted: false,
    appearStage: 2,
    type: "user_task",
    status: "ACTIVE",
  },
  // LEFT column
  {
    id: "memory",
    title: "MEMORY NODE",
    sub: "VIP customers always get instant refunds",
    Icon: Brain,
    x: LX,
    y: 150,
    column: "left",
    tainted: true,
    appearStage: 2,
    type: "poisoned_memory",
    sourceChunkId: "memory_91ab23",
    tenant: "tenant_demo",
    subTenant: "user_123",
    relevancy: 0.91,
    status: "TAINTED",
    riskReason: "Memory contradicts current refund policy",
  },
  {
    id: "policy",
    title: "POLICY NODE",
    sub: "Refunds above £500 require approval",
    Icon: FileText,
    x: LX,
    y: 270,
    column: "left",
    tainted: false,
    appearStage: 2,
    type: "clean_policy",
    sourceChunkId: "policy_v2_1",
    tenant: "tenant_demo",
    relevancy: 0.74,
    status: "TRUSTED",
  },
  {
    id: "document",
    title: "DOCUMENT NODE",
    sub: "Refund policy v2.1",
    Icon: File,
    x: LX,
    y: 390,
    column: "left",
    tainted: false,
    appearStage: 2,
    type: "document",
    sourceChunkId: "doc_refund_210",
    tenant: "tenant_demo",
    relevancy: 0.68,
    status: "TRUSTED",
  },
  {
    id: "skill",
    title: "SKILL NODE",
    sub: "refund-helper.SKILL.md (verified)",
    Icon: Code2,
    x: LX,
    y: 510,
    column: "left",
    tainted: false,
    appearStage: 3,
    type: "skill",
    status: "VERIFIED",
  },
  {
    id: "tool",
    title: "TOOL NODE",
    sub: "approve_refund()",
    Icon: Wrench,
    x: LX,
    y: 620,
    column: "left",
    tainted: false,
    appearStage: 3,
    type: "tool",
    status: "GATED",
  },
  // RIGHT column
  {
    id: "conflict",
    title: "CONFLICT DETECTED",
    sub: "Memory contradicts current policy",
    Icon: GitFork,
    x: RX,
    y: 150,
    column: "right",
    tainted: true,
    appearStage: 4,
    type: "policy_conflict",
    status: "CONFLICT",
    riskReason: "Poisoned memory overrides clean policy v2.1",
  },
  {
    id: "retrieval",
    title: "RETRIEVAL PATH",
    sub: "3 hops · 0.87 score",
    Icon: Share2,
    x: RX,
    y: 270,
    column: "right",
    tainted: false,
    appearStage: 3,
    type: "query_path",
    relevancy: 0.87,
    status: "TRAVERSED",
  },
  {
    id: "chunk",
    title: "CHUNK NODE",
    sub: "chunk_7f3a1c",
    Icon: Box,
    x: RX,
    y: 390,
    column: "right",
    tainted: false,
    appearStage: 3,
    type: "query_path",
    sourceChunkId: "chunk_7f3a1c",
    tenant: "tenant_demo",
    relevancy: 0.81,
    status: "RETRIEVED",
  },
  {
    id: "risk",
    title: "RISK DETECTED",
    sub: "Policy bypass attempt",
    Icon: AlertTriangle,
    x: RX,
    y: 510,
    column: "right",
    tainted: true,
    appearStage: 5,
    type: "unsafe_tool_action",
    status: "HIGH RISK",
    riskReason: "Agent attempts to approve refund, bypassing approval policy",
  },
  {
    id: "firewall",
    title: "MCP FIREWALL",
    sub: "Action blocked",
    Icon: ShieldAlert,
    x: RX,
    y: 620,
    column: "right",
    tainted: true,
    appearStage: 6,
    type: "mcp_firewall",
    status: "BLOCKED",
    riskReason: "Context firewall blocked the unsafe memory before the action",
  },
];

// ---- node edges (badge -> canopy or badge -> badge) ------------------------
export interface NodeEdge {
  /** Source badge id (or "canopy"). */
  from: string;
  /** Target badge id (or "canopy"). */
  to: string;
  tainted: boolean;
  /** Stage at which this edge becomes visible. */
  appearStage: number;
}

// Safe edges tie context nodes to the canopy; the tainted chain is the drama:
// memory -> conflict -> risk -> firewall (the path that caused, then blocked,
// the unsafe action).
export const NODE_EDGES: NodeEdge[] = [
  { from: "user_task", to: "canopy", tainted: false, appearStage: 2 },
  { from: "memory", to: "canopy", tainted: false, appearStage: 2 },
  { from: "policy", to: "canopy", tainted: false, appearStage: 2 },
  { from: "document", to: "canopy", tainted: false, appearStage: 2 },
  { from: "skill", to: "canopy", tainted: false, appearStage: 3 },
  { from: "tool", to: "canopy", tainted: false, appearStage: 3 },
  { from: "retrieval", to: "canopy", tainted: false, appearStage: 3 },
  { from: "chunk", to: "retrieval", tainted: false, appearStage: 3 },
  // tainted chain
  { from: "memory", to: "conflict", tainted: true, appearStage: 4 },
  { from: "conflict", to: "risk", tainted: true, appearStage: 5 },
  { from: "risk", to: "firewall", tainted: true, appearStage: 6 },
];

/** Ordered badge ids forming the demo tainted path (for highlight/travel). */
export const DEMO_TAINTED_PATH = ["memory", "conflict", "risk", "firewall"];

// ---- stage labels (shared with the keyframe strip) -------------------------
export const STAGE_LABELS = [
  "INIT",
  "SEED",
  "RETRIEVE",
  "BUILD PATHS",
  "CONFLICT",
  "RISK",
  "BLOCK",
  "REPORT",
] as const;

export const STAGE_COUNT = STAGE_LABELS.length; // 8
export const MAX_STAGE = STAGE_COUNT - 1; // 7

/** Badge center lookup, including the synthetic "canopy" anchor. */
export function badgeCenter(id: string): Pt {
  if (id === "canopy") return CANOPY;
  const b = DEMO_BADGES.find((n) => n.id === id);
  return b ? { x: b.x, y: b.y } : CANOPY;
}
