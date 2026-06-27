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
