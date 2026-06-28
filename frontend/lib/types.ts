/**
 * TypeScript contract for the HydraSentry backend RUN ARTIFACT and related
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

/**
 * Response of `POST /graph/real-query`: a genuine, just-now HydraDB
 * `query_paths` traversal against the pre-warmed owned tenant.
 *
 * Success carries `real:true` + `graph_source:"real_query_paths"` and the live
 * proof (query_ms, triplet_count) alongside the standard `graph` block the UI
 * already renders. On any backend failure it fails closed with `ok:false` and
 * `fallback:"captured"`, instructing the UI to fall back to the captured proof
 * sample. The UI must only show the LIVE label when `ok && real` AND
 * `graph_source === "real_query_paths"`.
 */
export interface LiveGraphQuery {
  ok: boolean;
  real: boolean;
  graph_source: GraphSource;
  graph_basis?: string;
  tenant_id?: string;
  sub_tenant_id?: string;
  scenario_id?: string;
  query_ms?: number;
  elapsed_ms?: number;
  triplet_count?: number;
  graph: Graph;
}

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

// --- Real run (POST /runs/real) --------------------------------------------

/**
 * The judge's own verdict on the poisoned answer, present only on a genuine
 * real run (mode:"real"). Null on the deterministic fallback.
 */
export interface RealRunJudge {
  score: number;
  confidence: number;
  rationale: string;
}

/**
 * Response of `POST /runs/real` — the GENUINELY-real run, distinct from the
 * deterministic RunArtifact. Within a ~9s budget the backend queries live
 * HydraDB (clean + poisoned owned sub-tenants), runs the real Groq agent on
 * each context, and computes a real risk score (rules + real Groq judge).
 *
 * HONESTY CONTRACT (mirrors backend/real_run.py):
 *  - `real:true` + `mode:"real"` → live Groq answers + a computed score. The UI
 *    may show a "REAL RUN" label only in this case.
 *  - `real:false` + `mode:"deterministic_fallback"` → on any HydraDB/Groq
 *    failure or wall-clock overrun the backend returns the deterministic
 *    canonical answers + score, with `fallback_reason`. The UI must label this
 *    as offline/deterministic, never as a real run.
 */
export interface RealRun {
  ok: boolean;
  real: boolean;
  mode: "real" | "deterministic_fallback" | (string & {});
  fallback_reason?: string;
  scenario_id: string;
  task: string;
  baseline_answer: string;
  poisoned_answer: string;
  behavior_diff?: BehaviorDiff;
  risk: {
    score: number;
    band: RiskBand;
    confidence: number;
    computed: boolean;
    attack_type?: string;
    components?: RiskComponents;
    rules_fired?: string[];
    judge?: RealRunJudge | null;
  };
  graph?: Graph;
  clean_sub_tenant?: string;
  poisoned_sub_tenant?: string;
  tenant_id?: string;
  llm_provider?: string;
  llm_model?: string;
  timings?: Record<string, number>;
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

// --- OWASP ASI06 standards mapping ------------------------------------------

/**
 * One control row from the self-verified OWASP ASI06 (Memory Poisoning) mapping
 * served at GET /standards/asi06. Mirrors backend/standards/asi06.py: each row
 * names the REAL implementing module and symbol, and the backend recomputes
 * `verified` against the running codebase, so a control is only shown as
 * verified when its cited code actually exists.
 */
export interface Asi06Control {
  id: string;
  title: string;
  summary: string;
  evidence_file: string;
  evidence_symbol: string;
  file_exists: boolean;
  symbol_present: boolean;
  verified: boolean;
}

/** Full ASI06 mapping artifact returned by GET /standards/asi06. */
export interface Asi06Mapping {
  taxonomy: string;
  risk_id: string;
  risk_name: string;
  reference: string;
  control_count: number;
  /** True only when every control's cited evidence was found in the codebase. */
  verified_all: boolean | null;
  controls: Asi06Control[];
}

// --- OWASP ASI Top-10 coverage map ------------------------------------------

/** Honest coverage level for a single ASI risk. */
export type AsiCoverage = "covered" | "partial" | "out_of_scope";

/**
 * One risk row from the self-verified OWASP ASI Top-10 coverage map served at
 * GET /standards/asi. Mirrors backend/standards/asi.py. covered/partial rows
 * name the REAL implementing module + symbol; out_of_scope rows carry null
 * evidence (and are "verified" by correctly carrying none). The headline ASI06
 * row also carries the verified ASI06 sub-controls.
 */
export interface AsiRisk {
  id: string;
  name: string;
  coverage: AsiCoverage;
  summary: string;
  evidence_file: string | null;
  evidence_symbol: string | null;
  file_exists: boolean;
  symbol_present: boolean;
  verified: boolean;
  subcontrols?: Asi06Control[];
}

/** Full ASI Top-10 coverage map returned by GET /standards/asi. */
export interface AsiMapping {
  taxonomy: string;
  reference: string;
  headline_risk_id: string;
  risk_count: number;
  coverage_counts: Record<AsiCoverage, number>;
  /**
   * True only when every row verifies: each covered/partial control's code
   * exists AND every out-of-scope row correctly carries no borrowed evidence.
   */
  verified_all: boolean | null;
  risks: AsiRisk[];
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
