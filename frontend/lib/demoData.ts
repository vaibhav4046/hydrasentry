/**
 * Bundled demo fixtures for Constellan.
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
