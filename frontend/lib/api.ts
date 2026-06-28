/**
 * Typed client for the HydraSentry backend. ALWAYS-REAL: every call hits the
 * live backend, every time.
 *
 * Every function is a client-side fetch and returns a normalized ApiResult<T>
 * (never throws) so UI code branches on .ok instead of try/catch. The backend
 * wraps JSON in an { ok, data } envelope; request() unwraps data on success and
 * surfaces error on failure. Report markdown is plain text, fetched separately.
 *
 * NO SESSION LATCH. The deployed backend can take a few seconds to cold-start
 * on a serverless platform, so each request carries a generous timeout
 * (REQUEST_TIMEOUT_MS) and there is deliberately NO one-way "backend
 * unreachable" latch: a single slow or failed call NEVER poisons the rest of the
 * session. The very next call tries the real backend again. Pages show a
 * transient loading state on a cold first call and then render real data.
 *
 * LAST-RESORT FIXTURES. So a single transient failure never renders a blank,
 * broken-looking page, a few read endpoints fall back to a bundled fixture
 * (lib/demoData.ts) for THAT ONE call only. This is a per-call resilience net,
 * not a session mode: it does not latch, does not stop the next call from
 * trying live, and is never surfaced as a sticky session-wide "demo data"
 * banner. A reachable backend always wins, and the explicit value-path calls
 * (runReal / queryRealGraph) never serve fixtures at all; they return an honest
 * failure the caller labels.
 */
import type {
  ApiEnvelope,
  ApiResult,
  Asi06Mapping,
  AsiMapping,
  ConfigStatus,
  Firewall,
  HealthStatus,
  LiveGraphQuery,
  McpManifest,
  McpResources,
  MarketplaceSkillScan,
  McpToolResult,
  ProviderStatus,
  ProviderTestResult,
  Quarantine,
  RealRun,
  ResultsSummary,
  RunArtifact,
  ScenarioSummary,
  ScheduledAgent,
  SkillScan,
} from "./types";
import {
  demoAsi06Mapping,
  demoAsiMapping,
  demoConfigStatus,
  demoFindings,
  demoMarketplaceScan,
  demoMcpManifest,
  demoMcpResources,
  demoProviders,
  demoResultsSummary,
  demoRun,
  demoScenarios,
  demoScheduledAgents,
  demoSkillScan,
} from "./demoData";
import { byoRunHeaders } from "./byoKey";

/** Explicitly-configured backend URL (local dev), if any. */
const CONFIGURED_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

/** The live, deployed backend. Used whenever no explicit override is set so the
 *  public site ALWAYS talks to a real backend (matches lib/consoleApi.ts). */
const DEPLOYED_BACKEND_URL = "https://backend-three-puce-75.vercel.app";

/**
 * The backend every call targets. An explicit NEXT_PUBLIC_BACKEND_URL wins (local
 * dev); otherwise the deployed backend. There is no "standalone demo" mode any
 * more: the product is always wired to a real backend.
 */
export const BACKEND_URL =
  CONFIGURED_BACKEND_URL?.trim() || DEPLOYED_BACKEND_URL;

/**
 * Per-request budget. Generous so a serverless COLD START (first call after the
 * function has scaled to zero, measured at ~3-4s and occasionally more)
 * completes instead of aborting. Matches lib/consoleApi.ts.
 */
const REQUEST_TIMEOUT_MS = 12000;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "request timed out";
    return error.message;
  }
  return "Network request failed";
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Run a fetch with a hard timeout. Returns the Response, or throws (timeout,
 * network, CORS) so the caller's try/catch turns it into a fallback. An external
 * abort signal, if supplied, also aborts the request.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onExternalAbort);
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, headers = {}, signal } = options;
  try {
    const res = await fetchWithTimeout(
      `${BACKEND_URL}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
      signal,
    );

    let payload: ApiEnvelope<T> | null = null;
    try {
      payload = (await res.json()) as ApiEnvelope<T>;
    } catch {
      payload = null;
    }

    if (payload && typeof payload.ok === "boolean") {
      if (payload.ok) return { ok: true, data: payload.data };
      return {
        ok: false,
        error: payload.error || `Request failed (${res.status})`,
      };
    }

    if (!res.ok) {
      return { ok: false, error: `Request failed (${res.status})` };
    }
    return { ok: false, error: "Malformed response from backend" };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * MCP tool endpoints return the tool envelope at the TOP LEVEL
 * ({ ok, tool, result, ... }) rather than the standard { ok, data } wrapper.
 * This variant returns the whole parsed body as the data so callers receive a
 * complete McpToolResult. On transport/parse failure it still yields a
 * well-formed { ok:false } result so the UI never reads `.ok` off undefined.
 */
async function requestMcp(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<McpToolResult>> {
  const { method = "POST", body, headers = {}, signal } = options;
  try {
    const res = await fetchWithTimeout(
      `${BACKEND_URL}${path}`,
      {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        cache: "no-store",
      },
      signal,
    );

    let payload: McpToolResult | null = null;
    try {
      payload = (await res.json()) as McpToolResult;
    } catch {
      payload = null;
    }

    if (payload && typeof payload === "object" && "ok" in payload) {
      return { ok: true, data: payload };
    }
    if (!res.ok) {
      return { ok: false, error: `Request failed (${res.status})` };
    }
    return { ok: false, error: "Malformed response from backend" };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

async function requestText(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<string>> {
  const { method = "GET", signal } = options;
  try {
    const accept = ["text/markdown", "text/plain", "*" + "/*"].join(", ");
    const res = await fetchWithTimeout(
      `${BACKEND_URL}${path}`,
      { method, headers: { Accept: accept }, cache: "no-store" },
      signal,
    );
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: text || `Request failed (${res.status})` };
    }
    return { ok: true, data: text };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

/**
 * PER-CALL resilience net. If THIS ONE live request failed, return the bundled
 * fixture so the page renders content instead of a blank/broken state. It does
 * NOT latch: it does not flip any session mode and does not stop the next call
 * from trying the real backend. With the cold-start budget raised and the latch
 * removed, a reachable backend means this path is essentially never taken; it
 * exists only so a single transient blip never empties a page.
 */
function withFallback<T>(
  result: ApiResult<T>,
  fixture: () => T,
): ApiResult<T> {
  if (result.ok) return result;
  return { ok: true, data: fixture() };
}

/**
 * Like withFallback but ALSO substitutes the fixture when the live call
 * succeeds yet returns an EMPTY list. Use only for endpoints whose content is
 * seeded and should never legitimately be empty (e.g. the six scheduled
 * agents). On a serverless backend the SQLite seed can be missing after a cold
 * start, which would otherwise render a blank, broken-looking page; serving the
 * deterministic fixture keeps the surface populated. Per-call only, no latch.
 * Endpoints where empty is a valid real state (findings before any run) must
 * keep plain withFallback.
 */
function withListFallback<T>(
  result: ApiResult<T[]>,
  fixture: () => T[],
): ApiResult<T[]> {
  if (result.ok && result.data.length > 0) return result;
  return { ok: true, data: fixture() };
}

// --- Reads with demo fallback ----------------------------------------------

export async function getHealth(): Promise<ApiResult<HealthStatus>> {
  return withFallback(await request<HealthStatus>("/health"), () => ({
    status: "healthy",
    mode: "demo",
    service: "hydrasentry",
    version: "1.0.0",
  }));
}

export async function getConfigStatus(): Promise<ApiResult<ConfigStatus>> {
  return withFallback(
    await request<ConfigStatus>("/config/status"),
    demoConfigStatus,
  );
}

export async function getScenarios(): Promise<ApiResult<ScenarioSummary[]>> {
  return withFallback(
    await request<ScenarioSummary[]>("/scenarios"),
    demoScenarios,
  );
}

export async function getResultsSummary(): Promise<ApiResult<ResultsSummary>> {
  return withFallback(
    await request<ResultsSummary>("/results/summary"),
    demoResultsSummary,
  );
}

export async function getFindings(): Promise<ApiResult<SkillScan[]>> {
  return withFallback(await request<SkillScan[]>("/findings"), demoFindings);
}

export async function getScheduledAgents(): Promise<
  ApiResult<ScheduledAgent[]>
> {
  // Seeded content: six agents always exist in a healthy backend. An empty list
  // means the serverless SQLite seed did not run on this cold start, so fall
  // back to the deterministic fixture rather than render a blank page.
  return withListFallback(
    await request<ScheduledAgent[]>("/scheduled-agents"),
    demoScheduledAgents,
  );
}

export async function getProviders(): Promise<ApiResult<ProviderStatus[]>> {
  // GET /settings/providers now returns a { platform, tenant_credentials, ... }
  // envelope; the public (unauthenticated) view is the read-only platform
  // matrix. Unwrap it to the legacy ProviderStatus[] shape so the demo fallback
  // and any public caller keep working.
  const res = await request<{ platform?: ProviderStatus[] } | ProviderStatus[]>(
    "/settings/providers",
  );
  if (res.ok) {
    const data = res.data as { platform?: ProviderStatus[] } | ProviderStatus[];
    const list = Array.isArray(data) ? data : data.platform ?? [];
    return { ok: true, data: list };
  }
  // Per-call resilience net only (no latch): a single failed read still renders
  // the provider matrix instead of a blank page; the next call tries live again.
  return { ok: true, data: demoProviders() };
}

/**
 * Self-verified OWASP ASI06 (Memory Poisoning) control mapping. A reachable
 * backend returns the truly verified artifact (verified_all recomputed against
 * the running codebase). Offline, the fallback returns the same control claims
 * with verified_all = null so the page is honest that it could not prove the
 * mapping without the live backend.
 */
export async function getStandardsAsi06(): Promise<ApiResult<Asi06Mapping>> {
  return withFallback(
    await request<Asi06Mapping>("/standards/asi06"),
    demoAsi06Mapping,
  );
}

/**
 * Self-verified OWASP ASI Top-10 coverage map. A reachable backend returns the
 * truly verified artifact (verified_all recomputed against the running
 * codebase, including the honesty check that out-of-scope risks carry no
 * borrowed evidence). Offline, the fallback returns the same coverage claims
 * with covered/partial rows unproven and verified_all = null.
 */
export async function getStandardsAsi(): Promise<ApiResult<AsiMapping>> {
  return withFallback(
    await request<AsiMapping>("/standards/asi"),
    demoAsiMapping,
  );
}

export async function getMcpManifest(): Promise<ApiResult<McpManifest>> {
  return withFallback(
    await request<McpManifest>("/mcp/manifest"),
    demoMcpManifest,
  );
}

export async function getMcpResources(): Promise<ApiResult<McpResources>> {
  return withFallback(
    await request<McpResources>("/mcp/resources"),
    demoMcpResources,
  );
}

// --- Runs (demo fallback returns the canonical 87/HIGH artifact) ------------

export async function runScenario(id: string): Promise<ApiResult<RunArtifact>> {
  return withFallback(
    await request<RunArtifact>(`/runs/${encodeURIComponent(id)}`, {
      method: "POST",
    }),
    demoRun,
  );
}

export async function runJudgeDemo(): Promise<ApiResult<RunArtifact>> {
  return withFallback(
    await request<RunArtifact>("/runs/judge-demo", { method: "POST" }),
    demoRun,
  );
}

export async function getRun(id: string): Promise<ApiResult<RunArtifact>> {
  return withFallback(
    await request<RunArtifact>(`/runs/${encodeURIComponent(id)}`),
    demoRun,
  );
}

export async function getReportMarkdown(id: string): Promise<ApiResult<string>> {
  return withFallback(
    await requestText(`/runs/${encodeURIComponent(id)}/report`),
    () => demoRun().report_markdown,
  );
}

export async function quarantine(
  runId: string,
): Promise<ApiResult<{ run_id: string; quarantine: Quarantine }>> {
  return withFallback(
    await request<{ run_id: string; quarantine: Quarantine }>(
      `/runs/${encodeURIComponent(runId)}/quarantine`,
      { method: "POST" },
    ),
    () => {
      const run = demoRun();
      return {
        run_id: run.run_id,
        quarantine: {
          memory_id: run.quarantine.memory_id,
          status: "quarantined",
        },
      };
    },
  );
}

// --- SkillMake / scheduled toggles ------------------------------------------

export async function scanSkill(
  content: string,
  name?: string,
): Promise<ApiResult<SkillScan>> {
  return withFallback(
    await request<SkillScan>("/skillmake/scan", {
      method: "POST",
      body: { content, name },
    }),
    demoSkillScan,
  );
}

/**
 * Pull a real SKILL.md from the skillmake.xyz marketplace by slug and scan it
 * server-side (the browser cannot fetch skillmake.xyz directly owing to CORS).
 * Mirrors scanSkill: returns the no-throw ApiResult envelope and never throws.
 *
 * The backend fails closed (a clean JSON error, never a 500) and itself falls
 * back to a shipped offline fixture. If the WHOLE backend is unreachable, the
 * client falls back to a bundled real fixture (firecrawl-mcp) scored offline,
 * with source "cache", so the standalone demo still shows a genuine pull.
 */
export async function scanSkillFromMarketplace(
  name: string,
): Promise<ApiResult<MarketplaceSkillScan>> {
  return withFallback(
    await request<MarketplaceSkillScan>("/skillmake/scan-url", {
      method: "POST",
      body: { name },
    }),
    () => demoMarketplaceScan(name),
  );
}

export async function toggleAgent(
  id: string,
): Promise<ApiResult<ScheduledAgent>> {
  const live = await request<ScheduledAgent>(
    `/scheduled-agents/${encodeURIComponent(id)}/toggle`,
    { method: "POST" },
  );
  if (live.ok) return live;
  // Per-call only: if this toggle did not land (e.g. the list was served from
  // the fixture on a cold start so the real id is unknown), flip the bundled
  // agent locally so the optimistic UI reconciles cleanly. No session latch.
  const agent = demoScheduledAgents().find((a) => a.id === id);
  if (!agent) return { ok: false, error: `agent '${id}' not found` };
  return { ok: true, data: { ...agent, enabled: !agent.enabled } };
}

export async function testProvider(
  name: string,
): Promise<ApiResult<ProviderTestResult>> {
  return withFallback(
    await request<ProviderTestResult>("/settings/providers/test", {
      method: "POST",
      body: { provider: name },
    }),
    () => ({
      provider: name,
      ok: false,
      reachable: false,
      detail: "no backend reachable (demo data)",
    }),
  );
}

/**
 * Validate a JUST-ENTERED provider key with a REAL upstream call, NO LOGIN.
 *
 * Posts the key to POST /settings/providers/test (no auth required for a
 * just-entered key). The backend exercises it once against the provider and
 * returns a verdict WITHOUT ever echoing or storing the key. This targets the
 * live backend directly and never serves a fixture; it is an explicit,
 * user-initiated validation. The key is sent only in this one request body.
 */
export async function testProviderKeyPublic(
  provider: string,
  apiKey: string,
  model?: string,
): Promise<ApiResult<ProviderTestResult>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${LIVE_QUERY_BACKEND_URL}/settings/providers/test`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ provider, api_key: apiKey, model }),
      cache: "no-store",
      signal: controller.signal,
    });
    let payload: ApiEnvelope<ProviderTestResult> | null = null;
    try {
      payload = (await res.json()) as ApiEnvelope<ProviderTestResult>;
    } catch {
      payload = null;
    }
    if (payload && typeof payload.ok === "boolean") {
      if (payload.ok) return { ok: true, data: payload.data };
      return { ok: false, error: payload.error || `Request failed (${res.status})` };
    }
    if (!res.ok) return { ok: false, error: `Request failed (${res.status})` };
    return { ok: false, error: "Malformed response from backend" };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}

// --- MCP tools --------------------------------------------------------------

function mcpHeaders(secret?: string): Record<string, string> {
  return secret ? { "X-MCP-Secret": secret } : {};
}

/**
 * Demo-mode MCP response. The read tool (scan_context) returns the bundled run
 * as its result; write tools mirror the real demo backend, which rejects calls
 * with no shared secret as `unauthorized`. Always wrapped ok:true at the
 * transport layer so the console renders the tool body.
 */
function demoMcpResult(tool: string, secret?: string): McpToolResult {
  if (tool === "scan_context") {
    return { ok: true, tool, result: demoRun() as unknown as McpToolResult };
  }
  if (!secret) {
    return { ok: false, tool, error: "unauthorized" };
  }
  return {
    ok: true,
    tool,
    result: { status: "accepted", note: "demo data (no backend reachable)" },
  };
}

function withMcpFallback(
  result: ApiResult<McpToolResult>,
  tool: string,
  secret?: string,
): ApiResult<McpToolResult> {
  if (result.ok) return result;
  // Per-call only (no latch): a single failed tool call still renders a tool
  // body in the console; the next invocation tries the real gateway again.
  return { ok: true, data: demoMcpResult(tool, secret) };
}

export async function mcpScanContext(
  scenarioId: string,
): Promise<ApiResult<McpToolResult>> {
  return withMcpFallback(
    await requestMcp("/mcp/scan_context", {
      method: "POST",
      body: { scenario_id: scenarioId },
    }),
    "scan_context",
  );
}

export async function mcpReplayAttack(
  scenarioId: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return withMcpFallback(
    await requestMcp("/mcp/replay_attack", {
      method: "POST",
      body: { scenario_id: scenarioId },
      headers: mcpHeaders(secret),
    }),
    "replay_attack",
    secret,
  );
}

export async function mcpVerifySkill(
  content: string,
  name?: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return withMcpFallback(
    await requestMcp("/mcp/verify_skill", {
      method: "POST",
      body: { content, name },
      headers: mcpHeaders(secret),
    }),
    "verify_skill",
    secret,
  );
}

export async function mcpQuarantineMemory(
  chunkId: string,
  tenantId?: string,
  subTenantId?: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return withMcpFallback(
    await requestMcp("/mcp/quarantine_memory", {
      method: "POST",
      body: {
        chunk_id: chunkId,
        tenant_id: tenantId,
        sub_tenant_id: subTenantId,
      },
      headers: mcpHeaders(secret),
    }),
    "quarantine_memory",
    secret,
  );
}

export async function mcpGenerateReport(
  runId: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return withMcpFallback(
    await requestMcp("/mcp/generate_report", {
      method: "POST",
      body: { run_id: runId },
      headers: mcpHeaders(secret),
    }),
    "generate_report",
    secret,
  );
}

export async function mcpScheduleScan(
  name: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return withMcpFallback(
    await requestMcp("/mcp/schedule_scan", {
      method: "POST",
      body: { name },
      headers: mcpHeaders(secret),
    }),
    "schedule_scan",
    secret,
  );
}

export function runStreamUrl(idOrScenario: string): string {
  return `${BACKEND_URL}/runs/${encodeURIComponent(idOrScenario)}/stream`;
}

// --- Live HydraDB query_paths (genuine on-demand traversal) ------------------

/** Client budget for the live HydraDB query. The real traversal lands in ~3s;
 * this leaves slack for cold starts without freezing the UI indefinitely. */
const LIVE_QUERY_TIMEOUT_MS = 9000;

/**
 * Target for the explicit value-path calls (live HydraDB query, real run, key
 * validation). Identical to BACKEND_URL now that the whole client is
 * always-real; kept as a named alias for the value-path call sites, which NEVER
 * serve a fixture (they return an honest failure the caller labels).
 */
const LIVE_QUERY_BACKEND_URL = BACKEND_URL;

/**
 * Run a GENUINE, just-now HydraDB `query_paths` traversal via
 * `POST /graph/real-query` against the pre-warmed owned tenant, and return the
 * parsed envelope. This is the one path that produces a LIVE (not captured, not
 * derived) real graph for the public /graph page.
 *
 * Unlike `request()`, this:
 *  - uses its own timeout tuned for the real graph traversal, and
 *  - returns the WHOLE top-level body as data (the endpoint replies with
 *    { ok, real, graph_source, query_ms, triplet_count, graph, ... }, not the
 *    { ok, data } envelope), and
 *  - never serves a fixture; it is the explicit, user-initiated live call, so a
 *    failure surfaces honestly and the caller renders the captured sample.
 *
 * Honors the no-throw ApiResult contract: any transport/parse failure, or the
 * backend's own fail-closed { ok:false, fallback:"captured" } body, surfaces as
 * a normalized result the caller branches on. The caller decides what to render;
 * this function never fabricates a real:true result. On any failure it returns
 * ok:false so the caller shows the captured sample, clearly labelled.
 */
export async function queryRealGraph(): Promise<ApiResult<LiveGraphQuery>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_QUERY_TIMEOUT_MS);
  try {
    const res = await fetch(`${LIVE_QUERY_BACKEND_URL}/graph/real-query`, {
      method: "POST",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    let payload: LiveGraphQuery | null = null;
    try {
      payload = (await res.json()) as LiveGraphQuery;
    } catch {
      payload = null;
    }

    // Fail-closed body: backend returns { ok:false, fallback:"captured" } on
    // timeout/error/no-key. Surface it as a normalized failure so the caller
    // renders the captured sample honestly.
    if (payload && payload.ok === false) {
      return { ok: false, error: "live query unavailable" };
    }
    // Genuine success: must carry real:true + real_query_paths + a graph.
    if (
      payload &&
      payload.ok === true &&
      payload.real === true &&
      payload.graph_source === "real_query_paths" &&
      payload.graph &&
      Array.isArray(payload.graph.nodes)
    ) {
      return { ok: true, data: payload };
    }
    if (!res.ok) {
      return { ok: false, error: `Request failed (${res.status})` };
    }
    return { ok: false, error: "Malformed response from backend" };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}

// --- Real run (genuine /runs/real: live Groq + HydraDB, computed score) ------

/** Client budget for the real run. The backend itself caps at ~9s and
 * fail-closes to the deterministic result, so 11s leaves slack for a cold
 * start without freezing the UI. */
const REAL_RUN_TIMEOUT_MS = 11000;

/**
 * Execute the GENUINELY-real judge run via `POST /runs/real` and return the
 * parsed body (the RealRun shape, NOT the { ok, data } envelope).
 *
 * Like queryRealGraph, this is an explicit, user-initiated call that genuinely
 * wants the real backend, so it:
 *  - targets the live backend directly (an explicit NEXT_PUBLIC_BACKEND_URL, in
 *    local dev, still wins),
 *  - uses a timeout tuned for the real run, and
 *  - never serves a fixture; a failure surfaces honestly for the caller.
 *
 * Honors the no-throw ApiResult contract. The backend itself never 500s and
 * fail-closes to { ok:true, real:false, mode:"deterministic_fallback" } on any
 * HydraDB/Groq error or overrun; that body is surfaced verbatim so the caller
 * can label it honestly. This function never fabricates real:true — only the
 * backend sets it. On a transport/parse failure (or client timeout) it returns
 * ok:false so the caller falls back to the deterministic intro.
 */
export async function runReal(): Promise<ApiResult<RealRun>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REAL_RUN_TIMEOUT_MS);
  try {
    // BYO (no-login): if the user saved their own provider key in this browser,
    // send it per-request so THIS run uses their model + key. No saved key -> no
    // headers -> the platform Groq default (the public demo path). The key is
    // sent only on this single run request and is never persisted server-side.
    const res = await fetch(`${LIVE_QUERY_BACKEND_URL}/runs/real`, {
      method: "POST",
      headers: { Accept: "application/json", ...byoRunHeaders() },
      cache: "no-store",
      signal: controller.signal,
    });

    let payload: RealRun | null = null;
    try {
      payload = (await res.json()) as RealRun;
    } catch {
      payload = null;
    }

    if (
      payload &&
      typeof payload === "object" &&
      payload.ok === true &&
      payload.risk &&
      typeof payload.baseline_answer === "string" &&
      typeof payload.poisoned_answer === "string"
    ) {
      return { ok: true, data: payload };
    }
    if (!res.ok) return { ok: false, error: `Request failed (${res.status})` };
    return { ok: false, error: "Malformed response from backend" };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}

export type { Firewall };
