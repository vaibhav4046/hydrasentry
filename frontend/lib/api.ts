/**
 * Typed client for the HydraSentry backend.
 *
 * Every function is a client-side fetch and returns a normalized ApiResult<T>
 * (never throws) so UI code branches on .ok instead of try/catch. The backend
 * wraps JSON in an { ok, data } envelope; request() unwraps data on success and
 * surfaces error on failure. Report markdown is plain text, fetched separately.
 *
 * Base URL: NEXT_PUBLIC_BACKEND_URL, defaulting to http://localhost:8000.
 */
import type {
  ApiEnvelope,
  ApiResult,
  ConfigStatus,
  Firewall,
  HealthStatus,
  McpManifest,
  McpResources,
  McpToolResult,
  ProviderStatus,
  ProviderTestResult,
  Quarantine,
  ResultsSummary,
  RunArtifact,
  ScenarioSummary,
  ScheduledAgent,
  SkillScan,
} from "./types";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Network request failed";
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, headers = {}, signal } = options;
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });

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

async function requestText(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<string>> {
  const { method = "GET", signal } = options;
  try {
    const accept = ["text/markdown", "text/plain", "*" + "/*"].join(", ");
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: { Accept: accept },
      signal,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: text || `Request failed (${res.status})` };
    }
    return { ok: true, data: text };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

export function getHealth(): Promise<ApiResult<HealthStatus>> {
  return request<HealthStatus>("/health");
}

export function getConfigStatus(): Promise<ApiResult<ConfigStatus>> {
  return request<ConfigStatus>("/config/status");
}

export function getScenarios(): Promise<ApiResult<ScenarioSummary[]>> {
  return request<ScenarioSummary[]>("/scenarios");
}

export function runScenario(id: string): Promise<ApiResult<RunArtifact>> {
  return request<RunArtifact>(`/runs/${encodeURIComponent(id)}`, {
    method: "POST",
  });
}

export function runJudgeDemo(): Promise<ApiResult<RunArtifact>> {
  return request<RunArtifact>("/runs/judge-demo", { method: "POST" });
}

export function getRun(id: string): Promise<ApiResult<RunArtifact>> {
  return request<RunArtifact>(`/runs/${encodeURIComponent(id)}`);
}

export function getReportMarkdown(id: string): Promise<ApiResult<string>> {
  return requestText(`/runs/${encodeURIComponent(id)}/report`);
}

export function quarantine(
  runId: string,
): Promise<ApiResult<{ run_id: string; quarantine: Quarantine }>> {
  return request(`/runs/${encodeURIComponent(runId)}/quarantine`, {
    method: "POST",
  });
}

export function getFindings(): Promise<ApiResult<SkillScan[]>> {
  return request<SkillScan[]>("/findings");
}

export function getScheduledAgents(): Promise<ApiResult<ScheduledAgent[]>> {
  return request<ScheduledAgent[]>("/scheduled-agents");
}

export function toggleAgent(id: string): Promise<ApiResult<ScheduledAgent>> {
  return request<ScheduledAgent>(
    `/scheduled-agents/${encodeURIComponent(id)}/toggle`,
    { method: "POST" },
  );
}

export function scanSkill(
  content: string,
  name?: string,
): Promise<ApiResult<SkillScan>> {
  return request<SkillScan>("/skillmake/scan", {
    method: "POST",
    body: { content, name },
  });
}

export function getResultsSummary(): Promise<ApiResult<ResultsSummary>> {
  return request<ResultsSummary>("/results/summary");
}

export function getProviders(): Promise<ApiResult<ProviderStatus[]>> {
  return request<ProviderStatus[]>("/settings/providers");
}

export function testProvider(
  name: string,
): Promise<ApiResult<ProviderTestResult>> {
  return request<ProviderTestResult>("/settings/providers/test", {
    method: "POST",
    body: { provider: name },
  });
}

export function getMcpManifest(): Promise<ApiResult<McpManifest>> {
  return request<McpManifest>("/mcp/manifest");
}

export function getMcpResources(): Promise<ApiResult<McpResources>> {
  return request<McpResources>("/mcp/resources");
}

function mcpHeaders(secret?: string): Record<string, string> {
  return secret ? { "X-MCP-Secret": secret } : {};
}

export function mcpScanContext(
  scenarioId: string,
): Promise<ApiResult<McpToolResult>> {
  return request<McpToolResult>("/mcp/scan_context", {
    method: "POST",
    body: { scenario_id: scenarioId },
  });
}

export function mcpReplayAttack(
  scenarioId: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return request<McpToolResult>("/mcp/replay_attack", {
    method: "POST",
    body: { scenario_id: scenarioId },
    headers: mcpHeaders(secret),
  });
}

export function mcpVerifySkill(
  content: string,
  name?: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return request<McpToolResult>("/mcp/verify_skill", {
    method: "POST",
    body: { content, name },
    headers: mcpHeaders(secret),
  });
}

export function mcpQuarantineMemory(
  chunkId: string,
  tenantId?: string,
  subTenantId?: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return request<McpToolResult>("/mcp/quarantine_memory", {
    method: "POST",
    body: {
      chunk_id: chunkId,
      tenant_id: tenantId,
      sub_tenant_id: subTenantId,
    },
    headers: mcpHeaders(secret),
  });
}

export function mcpGenerateReport(
  runId: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return request<McpToolResult>("/mcp/generate_report", {
    method: "POST",
    body: { run_id: runId },
    headers: mcpHeaders(secret),
  });
}

export function mcpScheduleScan(
  name: string,
  secret?: string,
): Promise<ApiResult<McpToolResult>> {
  return request<McpToolResult>("/mcp/schedule_scan", {
    method: "POST",
    body: { name },
    headers: mcpHeaders(secret),
  });
}

export function runStreamUrl(idOrScenario: string): string {
  return `${BACKEND_URL}/runs/${encodeURIComponent(idOrScenario)}/stream`;
}

export type { Firewall };
