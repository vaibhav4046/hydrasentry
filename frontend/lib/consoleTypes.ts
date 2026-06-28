/**
 * TypeScript contract for the HydraSentry SaaS console payloads — the
 * tenant-scoped incident store and per-user API keys. These mirror the FastAPI
 * DTOs in backend/main.py (_incident_dto, _api_key_dto) exactly.
 */
import type { RiskBand } from "./types";

/** One persisted incident row (newest-first feed). Mirrors _incident_dto. */
export interface Incident {
  id: string;
  tenant_id: string;
  scenario: string;
  risk_score: number;
  band: RiskBand | (string & {});
  decision: string;
  attack_type: string;
  graph_source: string;
  confidence: number;
  llm_provider: string;
  mode: string;
  baseline_answer: string;
  poisoned_answer: string;
  created_at: string | null;
}

/** One API key, RAW-secret-free for listing. Mirrors _api_key_dto. */
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  revoked: boolean;
}

/** POST /api-keys also returns the raw key exactly ONCE on creation. */
export interface CreatedApiKey extends ApiKey {
  raw_key: string;
}

/** POST /auth/sync result: the user's resolved tenant. */
export interface AuthSyncResult {
  user_id: string;
  email: string | null;
  tenant_id: string;
  tenant_slug: string;
  auth_method: string;
}

/**
 * One tenant detection rule. A rule is an EXAMPLE of poisoned text: the detector
 * embeds `signature_text` so paraphrases of the same attack get caught for this
 * tenant. Mirrors the backend _rule_dto (GET /rules row shape).
 */
export interface DetectionRule {
  id: string;
  name: string;
  signature_text: string;
  attack_type: string;
  severity: RuleSeverity | (string & {});
  enabled: boolean;
  created_at: string | null;
}

/** Severity ladder for a rule, mirrors the backend's accepted values. */
export type RuleSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** Body for POST /rules. The backend returns the created DetectionRule. */
export interface NewRule {
  name: string;
  signature_text: string;
  attack_type: string;
  severity: RuleSeverity;
  enabled: boolean;
}

/** Result of POST /rules/import: how many rows landed vs were skipped. */
export interface RuleImportResult {
  imported: number;
  skipped: number;
}

/**
 * One saved bring-your-own-key (BYO) provider credential, MASKED. Mirrors the
 * backend credential_dto: there is NO raw or encrypted key here, only the
 * masked sha256 fingerprint and metadata. The raw key never reaches the browser.
 */
export interface TenantProviderCredential {
  provider: string;
  label: string;
  model: string;
  key_fingerprint: string;
  configured: boolean;
  enabled: boolean;
  last_status: string;
  base_url: string;
  get_key_url: string;
  updated_at: string | null;
}

/** GET /settings/providers envelope: platform matrix + this tenant's BYO list. */
export interface ProvidersPayload {
  platform: ProviderStatusRow[];
  tenant_credentials: TenantProviderCredential[];
  encryption_available: boolean;
  /** True only for a signed-in user (the writable config UI is enabled). */
  can_configure: boolean;
}

/** A read-only platform provider row (masked fingerprint, never a raw key). */
export interface ProviderStatusRow {
  name: string;
  label?: string;
  model?: string;
  role?: string;
  base_url?: string;
  get_key_url?: string;
  configured: boolean;
  key?: { configured: boolean; fingerprint: string | null };
  [key: string]: unknown;
}

/** Body for POST /settings/providers (save a BYO credential). */
export interface SaveProviderBody {
  provider: string;
  api_key: string;
  model?: string;
}

/** Result of a real provider validation (POST /settings/providers/test). */
export interface ProviderTestOutcome {
  ok: boolean;
  provider?: string;
  status?: string;
  model?: string;
  http_status?: number;
  detail?: string;
  [key: string]: unknown;
}
