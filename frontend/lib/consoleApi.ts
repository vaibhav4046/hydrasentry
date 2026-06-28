/**
 * Authenticated console client for the HydraSentry backend.
 *
 * DISTINCT FROM lib/api.ts: the public marketing/demo pages ship with
 * NEXT_PUBLIC_BACKEND_URL unset so they serve bundled fixtures with zero failed
 * requests. The CONSOLE, by contrast, is an explicitly authenticated surface
 * that genuinely wants the real backend, so it targets the deployed backend
 * directly (CORS-allowlisted for the public origin) and NEVER falls back to a
 * fixture — a console must show the user's REAL data or an honest error, never
 * fabricated rows (operating rule #1).
 *
 * Auth: every console call sends the Supabase access token as
 * `Authorization: Bearer <jwt>`. The unauthenticated incident reads
 * (GET /incidents without a token -> demo tenant) are also routed here so the
 * signed-out dashboard shows the demo tenant's REAL persisted rows honestly.
 *
 * Every function returns a normalized ApiResult<T> (never throws); the backend
 * wraps JSON in { ok, data }. We unwrap on success and surface error on failure.
 */
import type { ApiResult, ApiEnvelope } from "./types";
import type {
  ApiKey,
  AuthSyncResult,
  CreatedApiKey,
  DetectionRule,
  Incident,
  NewRule,
  RuleImportResult,
} from "./consoleTypes";

/**
 * The console always talks to a REAL backend. An explicit NEXT_PUBLIC_BACKEND_URL
 * (local dev) wins; otherwise the deployed backend (same default as the live
 * graph/real-run paths in lib/api.ts).
 */
const CONFIGURED = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();
export const CONSOLE_BACKEND_URL =
  CONFIGURED && CONFIGURED.length > 0
    ? CONFIGURED
    : "https://backend-three-puce-75.vercel.app";

/** Per-request budget. Generous for a cold serverless start. */
const REQUEST_TIMEOUT_MS = 12000;

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "request timed out";
    return error.message;
  }
  return "network request failed";
}

interface ConsoleRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Supabase access token; omitted for the unauthenticated demo-tenant reads. */
  token?: string;
}

async function consoleRequest<T>(
  path: string,
  options: ConsoleRequestOptions = {},
): Promise<ApiResult<T>> {
  const { method = "GET", body, token } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${CONSOLE_BACKEND_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal,
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
    if (!res.ok) return { ok: false, error: `Request failed (${res.status})` };
    return { ok: false, error: "Malformed response from backend" };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}

// --- Auth -------------------------------------------------------------------

/** Idempotent sign-in sync: creates the user + personal tenant on first call. */
export function authSync(token: string): Promise<ApiResult<AuthSyncResult>> {
  return consoleRequest<AuthSyncResult>("/auth/sync", { method: "POST", token });
}

// --- Incidents (tenant-scoped) ----------------------------------------------

/**
 * List the caller's incidents, newest first. With a token -> the user's own
 * tenant; without -> the shared demo tenant's REAL persisted rows.
 */
export function listIncidents(token?: string): Promise<ApiResult<Incident[]>> {
  return consoleRequest<Incident[]>("/incidents", { token });
}

/** Fetch one incident by id (BOLA-safe: 404 if not in the caller's tenant). */
export function getIncident(
  id: string,
  token?: string,
): Promise<ApiResult<Incident>> {
  return consoleRequest<Incident>(`/incidents/${encodeURIComponent(id)}`, {
    token,
  });
}

// --- API keys (JWT required) ------------------------------------------------

export function listApiKeys(token: string): Promise<ApiResult<ApiKey[]>> {
  return consoleRequest<ApiKey[]>("/api-keys", { token });
}

export function createApiKey(
  name: string,
  token: string,
): Promise<ApiResult<CreatedApiKey>> {
  return consoleRequest<CreatedApiKey>("/api-keys", {
    method: "POST",
    body: { name },
    token,
  });
}

export function revokeApiKey(
  id: string,
  token: string,
): Promise<ApiResult<ApiKey>> {
  return consoleRequest<ApiKey>(`/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

// --- Detection rules (JWT required, tenant-scoped) ---------------------------

/**
 * List the tenant's detection rules, newest first. With a token -> the user's
 * own tenant; without -> the shared demo tenant's REAL rules (the backend
 * GET /rules resolves the demo tenant unauthenticated and returns its rows
 * read-only). Mirrors listIncidents(token?) so the signed-out console can show
 * the demo tenant's genuine ruleset, honestly labelled, never fabricated.
 */
export function listRules(token?: string): Promise<ApiResult<DetectionRule[]>> {
  return consoleRequest<DetectionRule[]>("/rules", { token });
}

/** Create a rule from an example of poisoned text (signature_text). */
export function createRule(
  rule: NewRule,
  token: string,
): Promise<ApiResult<DetectionRule>> {
  return consoleRequest<DetectionRule>("/rules", {
    method: "POST",
    body: rule,
    token,
  });
}

/** Patch a rule (e.g. toggle `enabled`, rename). Returns the updated row. */
export function updateRule(
  id: string,
  patch: Partial<NewRule>,
  token: string,
): Promise<ApiResult<DetectionRule>> {
  return consoleRequest<DetectionRule>(`/rules/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: patch,
    token,
  });
}

/** Delete a rule. */
export function deleteRule(
  id: string,
  token: string,
): Promise<ApiResult<{ id: string }>> {
  return consoleRequest<{ id: string }>(`/rules/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}

/** Import a JSON ruleset (the export shape). Returns counts. */
export function importRules(
  ruleset: unknown,
  token: string,
): Promise<ApiResult<RuleImportResult>> {
  return consoleRequest<RuleImportResult>("/rules/import", {
    method: "POST",
    body: ruleset,
    token,
  });
}

/**
 * Fetch the tenant's ruleset as raw JSON for download. This bypasses the
 * { ok, data } envelope unwrap because /rules/export returns the ruleset file
 * directly. Returns the parsed JSON (unknown shape) or an honest error.
 */
export async function exportRules(
  token: string,
): Promise<ApiResult<unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${CONSOLE_BACKEND_URL}/rules/export`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, error: `Export failed (${res.status})` };
    const data = (await res.json()) as unknown;
    // The backend may still wrap a data export in the standard envelope; unwrap
    // it if so, otherwise treat the body as the ruleset itself.
    if (
      data &&
      typeof data === "object" &&
      "ok" in data &&
      typeof (data as { ok: unknown }).ok === "boolean"
    ) {
      const env = data as ApiEnvelope<unknown>;
      return env.ok
        ? { ok: true, data: env.data }
        : { ok: false, error: env.error || "Export failed" };
    }
    return { ok: true, data };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  } finally {
    clearTimeout(timer);
  }
}
