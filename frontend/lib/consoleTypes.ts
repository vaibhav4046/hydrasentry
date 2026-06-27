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
