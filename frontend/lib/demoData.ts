/**
 * Bundled demo fixtures for HydraSentry.
 *
 * `fixtures/demo.json` is a STATIC SNAPSHOT captured from the FastAPI backend
 * running in demo mode (POST /runs/judge-demo, GET /scenarios, /results/summary,
 * /findings, /scheduled-agents, /settings/providers, /config/status,
 * /mcp/manifest, /mcp/resources, POST /skillmake/scan). It lets the deployed
 * frontend render every page and drive the full demo flow when NO backend is
 * reachable, while a live backend (when present) is always preferred.
 *
 * Honesty: this is demo/derived data, never live HydraDB. The canonical run
 * keeps graph_source = "derived_scenario_graph" and the UI surfaces a "demo
 * data" indicator whenever a fixture is served (see lib/demoMode.ts). Keys are
 * already masked to sha256 fingerprints in the snapshot; no raw secrets ship.
 *
 * Do not hand-edit the JSON values, re-capture from a running backend if the
 * contract changes.
 */
import type {
  Asi06Mapping,
  AsiMapping,
  AsiRisk,
  ConfigStatus,
  MarketplaceSkillScan,
  McpManifest,
  McpResources,
  ProviderStatus,
  ResultsSummary,
  RunArtifact,
  ScenarioSummary,
  ScheduledAgent,
  SkillScan,
} from "./types";
import { MARKETPLACE_DEMO_SKILL } from "@/components/skillmake/demoSkill";
import demo from "./fixtures/demo.json";

interface DemoBundle {
  judgeDemo: RunArtifact;
  scenarios: ScenarioSummary[];
  resultsSummary: ResultsSummary;
  findings: unknown[];
  scheduledAgents: ScheduledAgent[];
  providers: ProviderStatus[];
  configStatus: ConfigStatus;
  mcpManifest: McpManifest;
  mcpResources: McpResources;
  skillScan: SkillScan;
}

const bundle = demo as unknown as DemoBundle;

/**
 * Return a structured clone so callers that mutate (e.g. quarantine toggles the
 * artifact, scheduled-agents flips `enabled`) never corrupt the shared fixture.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const DEMO_RUN: RunArtifact = bundle.judgeDemo;
export const DEMO_SCENARIOS: ScenarioSummary[] = bundle.scenarios;
export const DEMO_RESULTS_SUMMARY: ResultsSummary = bundle.resultsSummary;
export const DEMO_FINDINGS = bundle.findings as unknown as SkillScan[];
export const DEMO_SCHEDULED_AGENTS: ScheduledAgent[] = bundle.scheduledAgents;
export const DEMO_PROVIDERS: ProviderStatus[] = bundle.providers;
export const DEMO_CONFIG_STATUS: ConfigStatus = bundle.configStatus;
export const DEMO_MCP_MANIFEST: McpManifest = bundle.mcpManifest;
export const DEMO_MCP_RESOURCES: McpResources = bundle.mcpResources;
export const DEMO_SKILL_SCAN: SkillScan = bundle.skillScan;
export const DEMO_REPORT_MARKDOWN: string = bundle.judgeDemo.report_markdown;

export const demoRun = (): RunArtifact => clone(DEMO_RUN);
export const demoScenarios = (): ScenarioSummary[] => clone(DEMO_SCENARIOS);
export const demoResultsSummary = (): ResultsSummary => clone(DEMO_RESULTS_SUMMARY);
export const demoFindings = (): SkillScan[] => clone(DEMO_FINDINGS);
export const demoScheduledAgents = (): ScheduledAgent[] => clone(DEMO_SCHEDULED_AGENTS);
export const demoProviders = (): ProviderStatus[] => clone(DEMO_PROVIDERS);
export const demoConfigStatus = (): ConfigStatus => clone(DEMO_CONFIG_STATUS);
export const demoMcpManifest = (): McpManifest => clone(DEMO_MCP_MANIFEST);
export const demoMcpResources = (): McpResources => clone(DEMO_MCP_RESOURCES);
export const demoSkillScan = (): SkillScan => clone(DEMO_SKILL_SCAN);

/**
 * Offline ASI06 mapping. The control CLAIMS (titles, summaries, evidence
 * anchors) are documentation mirrored from backend/standards/asi06.py, the
 * single source of truth. CRITICAL HONESTY: verification can only be recomputed
 * against the RUNNING codebase, so offline every control reports
 * file_exists/symbol_present/verified = false and verified_all = null. The page
 * renders that as "verification requires the live backend" instead of claiming a
 * green checkmark the browser cannot prove. A reachable backend always wins and
 * returns the truly self-verified mapping.
 */
const DEMO_ASI06_CLAIMS: ReadonlyArray<{
  id: string;
  title: string;
  summary: string;
  evidence_file: string;
  evidence_symbol: string;
}> = [
  {
    id: "ASI06.provenance",
    title: "Provenance labelling of retrieved memory",
    summary:
      "Every graph the engine reasons over is labelled REAL HydraDB query_paths vs a DERIVED scenario fallback vs a LOCAL heuristic graph, so a derived/demo result can never be passed off as a real HydraDB retrieval.",
    evidence_file: "backend/report.py",
    evidence_symbol: "_graph_label",
  },
  {
    id: "ASI06.tenancy",
    title: "Per-tenant isolation of stored memory (BOLA defense)",
    summary:
      "Poisoned-memory incidents and certificates are stored per tenant. Every repository read/write requires a tenant_id and filters by it; a cross-tenant lookup returns nothing, and a missing scope raises rather than returning a full table.",
    evidence_file: "backend/db/repo.py",
    evidence_symbol: "TenantScopingError",
  },
  {
    id: "ASI06.quarantine",
    title: "Forgetting / quarantine of poisoned memory",
    summary:
      "When the firewall severs a poisoned action, the offending memory is quarantined so it cannot reach the agent again, and the finding is converted into a persisted regression rule.",
    evidence_file: "backend/rules_store.py",
    evidence_symbol: "create_rule",
  },
  {
    id: "ASI06.ground_truth_eval",
    title: "Ground-truth behavior diff (not an asserted one)",
    summary:
      "Risk is computed by replaying the agent on a clean baseline vs the poisoned memory and diffing the resulting behaviour, producing a deterministic score and band rather than a hand-written verdict.",
    evidence_file: "backend/risk_engine.py",
    evidence_symbol: "score_scenario",
  },
  {
    id: "ASI06.taint_tracking",
    title: "Graph taint tracking from the poisoned source",
    summary:
      "The poisoned source chunk is taint-tracked through the graph so the certificate can record exactly which node carried the attack and which query_paths triplets it travelled.",
    evidence_file: "backend/risk_engine.py",
    evidence_symbol: "_graph_is_tainted",
  },
  {
    id: "ASI06.trust_scoring",
    title: "Trust scoring incl. semantic paraphrase detection",
    summary:
      "Beyond exact forbidden-marker matching, a semantic similarity signal flags reworded poison that paraphrases a policy override, so an attacker cannot evade detection by simple rewording.",
    evidence_file: "backend/semantic_detector.py",
    evidence_symbol: "def detect",
  },
  {
    id: "ASI06.certificate",
    title: "Portable Memory Integrity Certificate (MIC)",
    summary:
      "Each severed run is sealed into a portable certificate recording the behaviour diff, the tainted source chunk, the tool that would have fired, and the regression rule that now prevents it.",
    evidence_file: "backend/report.py",
    evidence_symbol: "generate_report",
  },
];

export const demoAsi06Mapping = (): Asi06Mapping => ({
  taxonomy: "OWASP Agentic Security Initiative (ASI)",
  risk_id: "ASI06",
  risk_name: "Memory Poisoning",
  reference: "https://genai.owasp.org/initiatives/#agenticsecurity",
  control_count: DEMO_ASI06_CLAIMS.length,
  // Offline: cannot recompute against the codebase, so do NOT assert verified.
  verified_all: null,
  controls: DEMO_ASI06_CLAIMS.map((c) => ({
    ...c,
    file_exists: false,
    symbol_present: false,
    verified: false,
  })),
});

/**
 * Offline claims for the full OWASP ASI Top-10 coverage map. Mirrors
 * backend/standards/asi.py. covered/partial rows name real evidence;
 * out_of_scope rows carry null evidence. Offline the page cannot recompute
 * verification, so verified is false for covered/partial rows and verified_all
 * is null -- the page renders an explicit "verification offline" state rather
 * than a fake green tick.
 */
const DEMO_ASI_CLAIMS: ReadonlyArray<
  Pick<AsiRisk, "id" | "name" | "coverage" | "summary" | "evidence_file" | "evidence_symbol">
> = [
  {
    id: "ASI01",
    name: "Tool Misuse",
    coverage: "covered",
    summary:
      "Agent tool calls flow through a gateway whose write tools are fail-closed and constant-time secret-gated, so an unauthenticated caller cannot drive a state-changing tool. Every call is logged for audit.",
    evidence_file: "backend/mcp_gateway.py",
    evidence_symbol: "_secret_guard",
  },
  {
    id: "ASI02",
    name: "Identity Spoofing & Privilege Compromise",
    coverage: "covered",
    summary:
      "Every protected surface resolves a real identity: a Supabase user-JWT verified against the project JWKS (ES256, issuer + aud + exp pinned) or a salted-hash, constant-time API key. There is no trust-by-header.",
    evidence_file: "backend/auth/jwt_verifier.py",
    evidence_symbol: "JWTVerificationError",
  },
  {
    id: "ASI03",
    name: "Privilege / Tenant Isolation (BOLA)",
    coverage: "covered",
    summary:
      "Stored memory, incidents, certificates, and detection rules are per tenant. Every repository read/write requires a tenant_id and filters by it; a cross-tenant lookup returns nothing, and a missing scope raises.",
    evidence_file: "backend/db/repo.py",
    evidence_symbol: "TenantScopingError",
  },
  {
    id: "ASI04",
    name: "Resource Overload",
    coverage: "covered",
    summary:
      "The real-cost and outbound paths are guarded by an in-process token-bucket rate limiter keyed on identity-or-IP; over-limit returns 429 + Retry-After. The one-click judge demo keeps a generous bucket.",
    evidence_file: "backend/rate_limit.py",
    evidence_symbol: "_TokenBuckets",
  },
  {
    id: "ASI05",
    name: "Cascading Hallucination / Behaviour Drift",
    coverage: "covered",
    summary:
      "Risk is a ground-truth behaviour diff, not a hand-written verdict: the agent is replayed on a clean baseline vs the poisoned memory and the resulting behaviour is diffed into a deterministic score and band.",
    evidence_file: "backend/risk_engine.py",
    evidence_symbol: "score_scenario",
  },
  {
    id: "ASI06",
    name: "Memory Poisoning",
    coverage: "covered",
    summary:
      "The headline risk this product is built for. Covered by the full self-verified ASI06 control mapping: provenance, quarantine, taint tracking, semantic paraphrase detection, and a portable Memory Integrity Certificate.",
    evidence_file: "backend/standards/asi06.py",
    evidence_symbol: "def verify_controls",
  },
  {
    id: "ASI07",
    name: "Insecure Output / Provenance Confusion",
    coverage: "covered",
    summary:
      "Every graph the engine reasons over is labelled REAL HydraDB vs DERIVED scenario fallback vs LOCAL heuristic graph, and the report renders that exact label, so a derived/demo result is never passed off as real.",
    evidence_file: "backend/report.py",
    evidence_symbol: "_graph_label",
  },
  {
    id: "ASI08",
    name: "Repudiation & Untraceability",
    coverage: "covered",
    summary:
      "Each severed run is sealed into a portable, signed Memory Integrity Certificate recording the behaviour diff, the tainted source chunk, the tool that would have fired, and the regression rule that now prevents it.",
    evidence_file: "backend/report.py",
    evidence_symbol: "generate_report",
  },
  {
    id: "ASI09",
    name: "Goal Manipulation via Reworded Injection",
    coverage: "partial",
    summary:
      "Partial: a semantic similarity signal flags reworded poison that paraphrases a policy override, raising the bar for a goal-manipulation injection. It is a detection signal, not a full intent-alignment guarantee.",
    evidence_file: "backend/semantic_detector.py",
    evidence_symbol: "def detect",
  },
  {
    id: "ASI10",
    name: "Overwhelming Human-in-the-Loop",
    coverage: "out_of_scope",
    summary:
      "Not addressed. HydraSentry is an automated memory-integrity firewall and certifier; it does not manage operator alert volume, approval fatigue, or human-in-the-loop pacing. Claiming coverage here would be dishonest.",
    evidence_file: null,
    evidence_symbol: null,
  },
];

export const demoAsiMapping = (): AsiMapping => {
  const risks: AsiRisk[] = DEMO_ASI_CLAIMS.map((c) => ({
    ...c,
    file_exists: false,
    symbol_present: false,
    // Offline: covered/partial cannot be re-verified from the browser, so they
    // are not asserted true. An out_of_scope row is "verified" by correctly
    // carrying no evidence -- that holds offline too, so it stays true.
    verified: c.coverage === "out_of_scope",
  }));
  const coverage_counts = risks.reduce(
    (acc, r) => {
      acc[r.coverage] = (acc[r.coverage] ?? 0) + 1;
      return acc;
    },
    { covered: 0, partial: 0, out_of_scope: 0 } as Record<AsiRisk["coverage"], number>,
  );
  return {
    taxonomy: "OWASP Agentic Security Initiative (ASI)",
    reference: "https://genai.owasp.org/initiatives/#agenticsecurity",
    headline_risk_id: "ASI06",
    risk_count: risks.length,
    coverage_counts,
    // Offline: covered/partial rows are unproven, so the map as a whole is not
    // asserted verified.
    verified_all: null,
    risks,
  };
};

/** Find a scenario fixture by id, falling back to the canonical refund run. */
export function demoScenarioById(id: string): ScenarioSummary | undefined {
  return demoScenarios().find((s) => s.id === id);
}

/**
 * Offline fallback for a skillmake.xyz marketplace pull. Returns the bundled
 * real firecrawl-mcp SKILL.md with a deterministic clean (LOW) scan — matching
 * what the live scanner produces for that benign tool skill — so the standalone
 * demo still shows a genuine pull (source "cache") when no backend is reachable.
 */
export function demoMarketplaceScan(slug: string): MarketplaceSkillScan {
  const name = slug || "firecrawl-mcp";
  const scan: SkillScan = {
    skill_hash: "demo-firecrawl",
    name,
    description:
      "Use when an agent needs Firecrawl through MCP: scrape pages, crawl sites, map URLs, search the web, or extract structured data from public web content.",
    risk_score: 0,
    band: "LOW",
    findings: [],
    unsafe_instructions: [],
    recommended_fix:
      "No unsafe instructions detected. Safe to use under normal review.",
    status: "approved",
  };
  return {
    fetch_ok: true,
    slug: name,
    source: "cache",
    url: `https://skillmake.xyz/i/${name}`,
    content: MARKETPLACE_DEMO_SKILL,
    scan,
  };
}
