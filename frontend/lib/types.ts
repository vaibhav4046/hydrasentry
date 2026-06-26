/**
 * TypeScript contract for the Constellan backend RUN ARTIFACT and related
 * payloads. These mirror the FastAPI responses (see backend/scenario_engine.py
 * and backend/main.py). String-literal unions reflect the documented contract;
 * where the live engine emits looser values (e.g. firewall mode strings,
 * baseline/poisoned verdicts), the field is widened with `(string & {})` so
 * unknown-but-valid values still type-check without losing autocomplete.
 */

/** Allows known literals while still accepting other backend strings. */
type Loose<T extends string> = T | (string & {});

// --- Graph primitives -------------------------------------------------------

export type GraphNodeType =
  | "user_task"
  | "clean_policy"
  | "poisoned_memory"
  | "query_path"
  | "policy_conflict"
  | "unsafe_tool_action"
  | "mcp_firewall"
  | "report";

export type TrustLevel = "trusted" | "poisoned" | "stale";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  trust: TrustLevel;
  status: string;
  source_chunk_id: string | null;
  tenant_id: string | null;
  sub_tenant_id: string | null;
  policy_version: string | null;
  risk_reason: string | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  tainted: boolean;
  label: string;
}

export interface Triplet {
  source: string;
  relation: string;
  target: string;
  source_chunk_id: string | null;
  tainted: boolean;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  tainted_path: string[];
  query_paths: Triplet[];
  source: string;
}

export type GraphSource = "real_query_paths" | "derived_scenario_graph";

// --- Risk -------------------------------------------------------------------

export type RiskBand = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface RiskComponents {
  rules: number;
  judge: number;
  replay: number;
}

export interface Risk {
  score: number;
  band: RiskBand;
  attack_type: string;
  confidence: number;
  components: RiskComponents;
  rules_fired: string[];
  deterministic_only: boolean;
}

// --- Firewall / quarantine --------------------------------------------------

export type FirewallDecision =
  | "allow"
  | "warn"
  | "block"
  | "quarantine"
  | "require_human_review";

/** Documented modes; the engine may emit composite strings (e.g.
 * "copilot_suggests_autopilot_acts"), so this is widened. */
export type FirewallMode = Loose<"manual" | "copilot" | "autopilot">;

export interface Firewall {
  decision: FirewallDecision;
  mode: FirewallMode;
  actions: string[];
}

export interface Quarantine {
  memory_id: string | null;
  status: string;
}

// --- Replay (baseline / poisoned) ------------------------------------------

/** Documented as "safe"/"compromised"-style verdicts; widened for safety. */
export type ReplayVerdict = Loose<"safe" | "compromised">;

export interface ReplayResult {
  answer: string;
  retrieved_chunk_ids: string[];
  verdict: ReplayVerdict;
  /** Present on live runs, not in the minimal contract. */
  tenant_id?: string | null;
  sub_tenant_id?: string | null;
}

export interface BehaviorDiff {
  changed: boolean;
  indicators: string[];
}

// --- Mission ----------------------------------------------------------------

export interface Mission {
  id: string;
  title: string;
  objective: string;
}

// --- SkillMake scan ---------------------------------------------------------

export interface SkillScanFinding {
  line_no: number;
  text: string;
  category: string;
  severity: string;
}

export interface SkillScan {
  skill_hash: string;
  name: string;
  description?: string;
  risk_score: number;
  band: RiskBand;
  findings: SkillScanFinding[];
  unsafe_instructions: string[];
  recommended_fix: string;
  status: string;
}

/**
 * Result of pulling a SKILL.md from the skillmake.xyz marketplace by slug and
 * scanning it server-side (POST /skillmake/scan-url). The fetch fails closed:
 * on a hard failure `fetch_ok` is false, `scan`/`content` are null, and `error`
 * explains why. `source` is "live" (fetched from skillmake.xyz) or "cache"
 * (served from the shipped offline fixture when the live fetch failed).
 */
export interface MarketplaceSkillScan {
  fetch_ok: boolean;
  slug: string;
  source: "live" | "cache" | "none";
  url: string;
  content: string | null;
  scan: SkillScan | null;
  error?: string;
}

// --- Scheduled scan / self-refinement --------------------------------------

export interface ScheduledScan {
  id: string;
  name: string;
  next_run: string;
  schedule: string;
}

export interface SelfRefinement {
  finding_accepted?: boolean;
  pattern?: string;
  rule_id?: string;
  regression_scenario_id?: string;
  future_scan?: string;
  ota?: unknown;
  timeline?: string[];
}

// --- Pipeline stages --------------------------------------------------------

export interface Stage {
  stage: string;
  status: string;
}

// --- The RUN ARTIFACT -------------------------------------------------------

export type RunMode = Loose<"demo" | "real">;

export interface RunArtifact {
  run_id: string;
  scenario_id: string;
  created_at: string;
  mode: RunMode;
  mission: Mission;
  graph_source: GraphSource;
  baseline: ReplayResult;
  poisoned: ReplayResult;
  behavior_diff: BehaviorDiff;
  risk: Risk;
  graph: Graph;
  firewall: Firewall;
  quarantine: Quarantine;
  skill_scan: SkillScan | null;
  report_markdown: string;
  scheduled_scan: ScheduledScan;
  self_refinement: SelfRefinement;
  stages: Stage[];
}

// --- Auxiliary endpoint payloads -------------------------------------------

export interface HealthStatus {
  status: string;
  mode: string;
  service: string;
  version: string;
}

export interface ProviderStatus {
  name: string;
  configured: boolean;
  model?: string;
  masked_key?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ConfigStatus {
  app_mode: string;
  is_real_mode: boolean;
  hydra: Record<string, unknown>;
  mcp_shared_secret: Record<string, unknown> | string;
  providers: ProviderStatus[];
  cors_origins: string[];
  frontend_url: string | null;
}

export interface ScenarioSummary {
  id: string;
  title: string;
  attack_type?: string;
  mission?: Mission;
  /** Deterministic per-scenario fields, surfaced for the Replay Lab tabs. */
  task?: string;
  baseline_answer?: string;
  poisoned_answer?: string;
  expected_safe_behavior?: string;
  forbidden_behavior?: string;
  [key: string]: unknown;
}

export interface ScheduledAgent {
  id: string;
  name: string;
  schedule: string;
  next_run: string;
  enabled: boolean;
  [key: string]: unknown;
}

export interface ResultsSummary {
  [key: string]: unknown;
}

export interface ProviderTestResult {
  provider: string;
  ok: boolean;
  [key: string]: unknown;
}

export interface McpManifest {
  [key: string]: unknown;
}

export interface McpResources {
  [key: string]: unknown;
}

export interface McpToolResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

// --- API envelope -----------------------------------------------------------

/** Every JSON endpoint wraps payloads as { ok, data } | { ok:false, error }. */
export type ApiEnvelope<T> =
  | { ok: true; data: T; [key: string]: unknown }
  | { ok: false; error: string; [key: string]: unknown };

/** Normalized client result so callers never throw on network/HTTP errors. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
