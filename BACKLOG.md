# HydraSentry Backlog

Phase 0 checkpoint backlog. Two parts:

1. **The 8-axis self-scoring rubric** with the gaps under each axis below 9 and
   the Beast-Mode phase that closes each gap.
2. **The full recon findings log** with severity and target phase.

Scoring is 1 to 10, self-assessed against the recon rubric inputs plus judgment.
Honest, not inflated: the product is real where it claims to be, and the
roadmap is real about what is not built yet.

## Part 1: 8-axis self-scores

Phase deltas are noted inline. Phase 1 shipped real Postgres persistence with
enforced multi-tenant isolation (tenant-scoped repo, reversible migrations,
BOLA-denied across tenants, incidents + signed certificates persisted, audit
log per action). Phase 2 (backend) added real authentication on that store:
Supabase user-JWT verified via the project JWKS (ES256, issuer+aud+exp pinned)
plus per-user API keys (salted-hash, constant-time, raw shown once), per-user
tenants, and connect-your-agent persistence (an API-key agent's run lands in its
own tenant, not demo) -- with the public unauthenticated showcase preserved and
fail-closed default-deny on user-data endpoints. Phase 5 (backend) added a
per-tenant detection-rule store (a signed-in user manages their own poison
signatures that feed their tenant's semantic detection, BOLA-safe, with
JSON export/import) and resolved all five red-team findings (app-level rate
limiting on the cost/outbound paths, fail-closed + constant-time MCP secret,
security response headers, recon-trimmed `/config/status`, and gated anon state
mutations). 173 green tests (26 new across Phase 2 + Phase 5), migrations 0002
and 0003 applied to the live Supabase Postgres.

| Axis | Score | One-line basis |
|------|-------|----------------|
| Realness | 8 | Real Groq attack + real HydraDB graph + real judge + real MCP server; fail-closed when degraded. Gap: real path is the unreliable branch under quota. |
| Technical depth | 9 | **Phase 5 (+1):** per-tenant detection-rule store wired into the real semantic path -- a tenant's enabled rule embeds and lifts its own scan band (proven by test, not decorative); pending/fail-closed when embeddings are down. Replay harness, graph taint tracing, deterministic+LLM risk fusion + semantic (embedding) paraphrase detection, native stdio MCP, MIC signing. |
| Production hardening | 9 | **Phase 5 (+1):** app-level rate limiting on the cost/outbound paths (tight token-bucket on `/runs/real` + `/skillmake/scan-url`, looser on demo-write/key-create, generous on the one-click judge demo; 429 + Retry-After), security response headers on every response (nosniff/DENY/Referrer-Policy), reversible migration 0003 (rule-store columns) applied to live Postgres + a self-healing bool-column type fix. **Phase 2-BE:** real auth on the app store (Supabase user-JWT via JWKS/ES256 + per-user API keys), per-user tenants, connect-your-agent persistence; auth off the event loop, fail-closed. **Phase 1:** durable Postgres app store, reversible/idempotent migrations, tenant-scoped repo. 173 green tests. |
| Standards / OWASP ASI06 | 7 | Directly targets agent memory poisoning (ASI06) with replay + provenance + firewall. Gap: no formal control mapping doc, no semantic coverage claim. |
| Usability | 8 | One-click judge demo, honest REAL-vs-DERIVED labels, console, native MCP install, **Phase 1:** GET /incidents + /incidents/{id} history endpoints. Gap: GET on a POST-only route 404s confusingly (Phase 1 quick, still open). |
| Polish | 9 | ESLint clean, TS clean, build green, masthead-paint fixes, honest-state on dead controls. |
| Security-of-itself | 9 | **Phase 5 (+1):** all five red-team findings resolved -- MCP secret guard is now FAIL-CLOSED when unset + constant-time (`hmac.compare_digest`) on both the HTTP gateway and the native stdio server; security headers on every response; `/config/status` recon-trimmed (anon sees only mode flags, full provider/fingerprint matrix requires a signed-in user, key `length` dropped); anon state mutations (quarantine/toggle) no longer write shared state (simulated 200 for the demo, real write only for a signed-in user); rate limiting blunts cost-path abuse. Rule store is BOLA-safe (cross-tenant read/patch/delete -> 404; demo ruleset read-only). **Phase 2-BE:** JWT via JWKS (ES256, issuer+aud+exp pinned), salted-hash API keys constant-time, default-deny user-data endpoints, BOLA under real credentials. **Phase 1:** tenant scoping, default-deny repo, search_path guard, DSN redaction. |
| Narrative | 9 | Clear thesis (graph-memory agents inherit a blind spot prompt-testing misses), replay -> trace -> block -> certify arc, honest provenance. |

### Gaps under each axis below 9

**Realness (8)**
- HIGH: Real Groq path is intermittent under repeated calls (free-tier 429). Mitigated in Phase 0 by one transient retry + diagnostics; full hardening (single-flight, judge-only fallback, pin-and-cache) -> **Phase 3-4**.
- LOW: `/graph/real-query` can return `real:true` with 0 nodes if the owned tenant has no current triplets; keep prewarm populated or surface an explicit empty state -> **Phase 3**.

**Technical depth (8)**
- HIGH: Detection is lexical (cue-list substring + regex), so paraphrased unlabelled poison can evade it. Needs an embedding/contradiction classifier -> **Phase 3 (semantic detector)**.

**Production hardening (8)**
- DONE (Phase 2-BE): Auth on the app store. Supabase user-JWT (JWKS/ES256,
  issuer+aud+exp enforced) + per-user API keys (salted-hash, constant-time,
  raw-once); per-user tenants; an API-key agent's /runs/real lands in its user's
  tenant (connect-your-agent), proven on live Postgres. Public unauthenticated
  showcase preserved (demo tenant). Migration 0002 applied to live Postgres.
- DONE (Phase 5): App-level rate limiting on the real-cost / outbound paths
  (token-bucket, 429 + Retry-After), security response headers on every response.
- DONE (Phase 5): MCP gateway secret guard is now fail-closed when unset +
  constant-time (`hmac.compare_digest`); same on the native stdio server's
  write-tool gate.
- MEDIUM: CORS `['*']` + credentials fallback when CORS_ORIGINS empty (set
  explicitly in deploy) -> remaining.
- DONE (Phase 1): Durable Postgres app store (SQLModel + psycopg2), reversible
  idempotent migrations (`python -m db.migrate up|down|reset|seed`), tenant-scoped
  repo, persistence wired into /runs/real. **The legacy SQLite + `runs/*.json`
  path is unchanged (run replay/report still uses it); the new Postgres store is
  the multi-tenant incident/certificate/audit history.** Real Postgres
  connection was NOT live-verified: the `.env` `DATABASE_URL` points at
  `localhost:5432` (refused) and the Supabase project `gwytslpqvqfewsjcqmuj` was
  unreachable in every pooler region (`ENOTFOUND tenant or user not found`) and
  its direct host does not resolve -> **strongly indicates a paused/inactive
  project**. All Phase 1 proofs (migration round-trip, persistence, BOLA,
  fail-closed) ran against a real DB engine (sqlite); the same driver-agnostic
  code path drives Postgres the moment the project is resumed. **Live Postgres
  verification deferred to ops: fix `DATABASE_URL` (real session-pooler host +
  `postgres.<ref>` user) and run `python -m db.migrate up`.**

**Standards / OWASP ASI06 (7)**
- Gap: No explicit ASI06 control-mapping document tying each engine component to the standard; semantic-coverage limitation not yet framed against the standard -> **Phase 3-4 (docs + semantic detector)**.

**Usability (8)**
- LOW: `GET /runs/judge-demo` 404s (route is POST); add a GET alias or document the method -> **Phase 1 (quick)**.

**Security-of-itself (7)**
- DONE (Phase 1): Enforced multi-tenant isolation. Every domain row carries a
  `tenant_id`; the tenant-scoped repo refuses any query without one (default-deny)
  and filters reads/writes by it. BOLA proven denied: tenant B requesting tenant
  A's incident id gets `None` at the repo and a 404 over HTTP that leaks no
  incident data. Hardened on review: `search_path` schema-name injection guard in
  the DSN sanitizer, DB credential redaction in surfaced error detail.
- MEDIUM: All HTTP surfaces unauthenticated, including real-cost paths -> **Phase 2**.
- PHASE 1 -> PHASE 2 carry: tenant is resolved from an unauthenticated
  `X-Tenant-Slug` header and `persist_run` auto-provisions an unknown tenant on
  write. Phase 2 auth must (a) derive the tenant from the authenticated user and
  (b) replace `TenantRepo.ensure` on the write path with a strict get-or-403 so
  anonymous callers cannot create tenants.
- LOW (Phase 1 review, deferred): `User.tenant_id` is nullable by design until
  Phase 2 auth; add a NOT NULL / CHECK before populating users for real.
- MEDIUM: MCP gateway fails open (allow writes with warning) when `MCP_SHARED_SECRET` is unset; set in deploy so closed in practice -> **Phase 2**.
- MEDIUM: `quarantine_memory` trusts caller-supplied tenant ids (no owned-tenant allowlist); gated behind `X-MCP-Secret` today -> **Phase 2-3**.
- LOW: CORS `['*']` + `allow_credentials=True` fallback when `CORS_ORIGINS` empty; real allowlist set in deploy -> **Phase 2**.

## Part 2: Recon findings log

Severity is the recon severity. Phase is when it is addressed. `fixNow` items
were fixed in this Phase 0 pass.

| # | Area | Severity | Phase | Status |
|---|------|----------|-------|--------|
| 1 | Groq real-path reliability (`real_agent._groq_chat` / `real_run.py`): intermittent degrade to deterministic fallback under repeated calls (free-tier 429). | HIGH | Phase 0 (partial) + Phase 3-4 | **DONE (Phase 0):** added one transient retry honouring `Retry-After`. Full single-flight / judge-only fallback / pin-and-cache -> Phase 3-4. |
| 2 | Observability of Groq failure (`real_agent.py` ~line 76-81): non-200 + transport collapsed to one opaque reason. | MEDIUM | Phase 0 | **DONE (Phase 0):** failure reason now carries upstream cause (`groq 429 rate_limited`, `groq 401 auth`, `groq 404 model_not_found`, `groq <5xx> upstream_error`, transport, no_key) surfaced in `fallback_reason`. |
| 3 | Demo hardening for Groq quota: 3 Groq calls/run can exhaust burst quota; single-flight, judge-only fallback, pin-and-cache. | MEDIUM | Phase 3-4 | Backlog. Partly mitigated by finding 1 retry. |
| 4 | Route method mismatch `GET /runs/judge-demo` returns 404 (route is POST). | LOW | Phase 1 | Backlog. Add GET alias or document method. |
| 5 | Fail-closed contract (positive finding): every failure is HTTP 200, labelled, never masquerades as real. | LOW | n/a | Confirmed correct; no action. |
| 6 | Semantic detection (`adapters/local_scan.py`): paraphrased unlabelled poison evades the lexical cue list. | HIGH | Phase 3 | Backlog (semantic detector). Limitation documented in README; document in demo too. |
| 7 | SkillMake static scanner (`skillmake_scanner.py`): regex-only under-scores reworded exfil. | HIGH | Phase 3 | Backlog. Tighten regexes near-term; semantic detection later. Document regex coverage limit. |
| 8 | Auth on the app-store HTTP surfaces (`main.py` + `auth/`): incidents + key management + real-run persistence were unauthenticated. | MEDIUM | Phase 2 | **DONE (Phase 2-BE):** additive/optional auth -- Supabase user-JWT (JWKS/ES256, issuer+aud+exp pinned; alg=none/wrong-key/wrong-project -> 401) + per-user API keys (salted-hash, constant-time, raw-once). `/auth/sync`, `/api-keys` GET/POST/DELETE are default-deny (`Depends(require_user)`); `/incidents`, `/incidents/{id}`, `/runs/real` resolve the caller's own tenant (JWT or API key) or the demo tenant when unauthenticated. BOLA holds under real credentials. Migration 0002 (api_keys + users.supabase_sub) applied to live Postgres. Public showcase preserved. Self-red-teamed; 20 new tests. Remaining HTTP surfaces (run-replay, MCP) -> Phase 2-3. |
| 9 | Tenant isolation on real quarantine (`mcp_gateway.py` -> `quarantine_memory`): caller-supplied tenant ids, no allowlist (gated by `X-MCP-Secret`). | MEDIUM | Phase 2-3 | Backlog (owned-tenant allowlist). |
| 10 | MCP gateway fail-open branch (`mcp_gateway.py` `_secret_guard`): writes allowed with warning if secret unset (set in deploy). | MEDIUM | Phase 5 | **DONE (Phase 5):** now FAIL-CLOSED -- an unset `MCP_SHARED_SECRET` refuses write tools (`unauthorized`); compare switched to constant-time `hmac.compare_digest`. Same fail-closed + constant-time write-tool gate added to the native stdio server (`HYDRASENTRY_MCP_SECRET`). Tests + native stdio smoke prove refusal. |
| 11 | CORS config (`main.py` / `config.py` `_cors_list`): `['*']` + credentials fallback when `CORS_ORIGINS` empty (real allowlist in deploy). | LOW | Phase 2 | Backlog (drop wildcard fallback or disable credentials when wildcarding). |
| 12 | `/graph/real-query` empty-graph path: `real:true` with 0 nodes if owned tenant has no current triplets. | LOW | Phase 3 | Backlog (keep prewarm populated or surface explicit empty state). |
| 13 | `backend/pytest`: suite fully green, no masked/xfail tests. | LOW | n/a | Confirmed; no action. |
| 14 | `frontend/lint+build`: ESLint clean, Next 16 build + TS clean, 11 routes. | LOW | n/a | Confirmed; no action. |
| 15 | `backend/hydrasentry_mcp` native stdio MCP: imports clean, JSON-RPC works, 7 tools, 9/9 tests incl. fail-closed + tamper detection. | LOW | n/a | Confirmed; no action. |
| 16 | Live `POST /runs/real`: deployment can cold-start into deterministic fallback (Groq env/latency); fail-closed contract intact. | MEDIUM | Phase 0 (diagnosability) + ops | Diagnosability improved by findings 1-2. Env/latency check on deployment is ops, not a code edit. |
| 17 | `real_run.py` `_deterministic_fallback`: `judge=None`, `computed=False` by design in fallback. | LOW | n/a | Confirmed by-design; no action. |
| 18 | Phase 1 persistence + multi-tenant isolation (`db/` package): Postgres app store, reversible migrations, tenant-scoped repo, BOLA-denied, incidents + signed certificates persisted, audit log per action. | ROADMAP | Phase 1 | **DONE (Phase 1):** 16 new tests; BOLA proven (tenant B -> None/404, no data leak); migration up/down reversible + idempotent; seed repeatable; persistence fail-closed when DB down (surfaced, never faked). |
| 19 | `.env` `DATABASE_URL` appeared to point at `localhost:5432` (refused). ROOT CAUSE: a stray persistent shell `DATABASE_URL=localhost` shadowed `backend/.env` because `config.py` loaded dotenv with `override=False`, so the shell var won. NOT a paused project. | HIGH | Phase 1 | **RESOLVED (Phase 1):** `config.py` now loads `.env` with `override=True` and the stray var was cleared. The REAL Supabase Postgres 17.6 (session pooler, port 5432) is reachable; `python -m db.migrate up` created all 6 tables live (verified in `information_schema`). Real persistence proven end-to-end against live Supabase: an Incident + CRITICAL Certificate persisted, retrieved tenant-scoped, BOLA-denied, and confirmed via raw SQL in the `incidents` table (verification rows cleaned up). Conftest pins the suite to throwaway sqlite so CI stays offline + green despite `override=True`. |
| 20 | Phase 1 review carries (DB): `checkfirst` migrations skip column-drift (no Alembic); single random UUIDv4 PKs fragment index at scale; `JSON` (not `JSONB`) so `fields`/`detail` not queryable inside. | LOW | Phase 2-3 | Backlog. Acceptable at current scale; revisit with Alembic + JSONB if the store grows. |
| 21 | Phase 1 review carry: persistence auto-provisions a tenant on write via `X-Tenant-Slug` (no auth); CORS wildcard fallback unchanged. | MEDIUM | Phase 2 | Backlog (folded into Phase 2 auth + CORS allowlist). |
| 22 | Red-team #1 -- no rate limiting on real-cost / outbound endpoints (`/runs/real` real Groq spend, `/skillmake/scan-url` outbound fetch). | MEDIUM | Phase 5 | **DONE (Phase 5):** dependency-free in-process token bucket keyed on identity-or-IP. Tight caps on the cost/outbound paths, looser on demo-write/key-create, generous on the one-click `/runs/judge-demo`. Over-limit -> 429 + JSON body + `Retry-After`. Read paths untouched. Test: a burst trips 429; judge demo stays usable. |
| 23 | Red-team #2 -- MCP secret guard fail-open + non-constant-time compare. | LOW | Phase 5 | **DONE (Phase 5):** see finding #10 (fail-closed when unset + `hmac.compare_digest`, HTTP gateway + native stdio). |
| 24 | Red-team #3 -- missing security response headers. | LOW | Phase 5 | **DONE (Phase 5):** middleware adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` to every response (incl. error envelopes). Tested. |
| 25 | Red-team #4 -- `/config/status` reconnaissance: full provider/model/fingerprint matrix + key length exposed to anyone. | LOW | Phase 5 | **DONE (Phase 5):** anon callers get only `{app_mode, is_real_mode}`; the detailed matrix requires a signed-in user (JWT); key `length` dropped from `key_status` (fingerprint alone). Tested anon-trim vs user-full. |
| 26 | Red-team #5 -- unauth state mutations: `POST /runs/{id}/quarantine` + `POST /scheduled-agents/{id}/toggle` wrote shared demo state anonymously. | LOW | Phase 5 | **DONE (Phase 5):** the shared run/agent stores are global (not tenant-scoped), so an anon caller now gets a coherent SIMULATED 200 (`simulated:true`) that computes the would-be result but persists nothing; a signed-in user performs the real, persisted mutation. No anon write to shared state; public demo stays coherent. Tested (anon no-persist, authed persists). |
| 27 | Phase 5 -- per-tenant detection-rule store (`rules_store.py` + `/rules*`): a signed-in user manages their own poison signatures that feed their tenant's semantic detection. | ROADMAP | Phase 5 | **DONE (Phase 5):** CRUD + export/import (schema-validated, dedup by signature) over the existing `RegressionRule` model (reversible migration 0003 adds `signature_text/attack_type/severity/enabled/embedded`, applied to live Postgres + a self-healing bool-column type fix). All endpoints auth-required via `current_identity` -> tenant, BOLA-safe (cross-tenant read/patch/delete -> 404), demo tenant read-only. A tenant's enabled+embedded rules are consulted by its `/scan/local` semantic path (real effect, proven by test: a tenant rule lifts its own scan band); embeddings-unavailable -> rule stored PENDING, never faked. |

### Phase 1 blocker status: RESOLVED (now live on real Supabase Postgres)

The Phase 1 code is **built, proven, and now running on the real Supabase
Postgres 17.6**: a `db/` package (engine + models + reversible migrations +
tenant-scoped repo + persistence service) is wired into `/runs/real`, and the
multi-tenant/BOLA/fail-closed contract is verified by the test suite (sqlite,
offline) AND proven end-to-end against the live database. The legacy
`storage.py` (SQLite + `runs/*.json`) is intentionally left in place for run
replay/report; the new Postgres store is the durable multi-tenant
incident/certificate/audit history.

**Root cause of the earlier "unreachable" finding (resolved):** it was NOT a
paused project. A stray persistent shell `DATABASE_URL=localhost` was shadowing
`backend/.env`, and `config.py` loaded dotenv with `override=False`, so the shell
var won. Fixed by `load_dotenv(..., override=True)` + clearing the stray var.
With that, the session pooler (port 5432) is reachable and `python -m db.migrate
up` created all 6 tables live (confirmed in `information_schema`).

Local end-to-end proof against live Supabase: an Incident + CRITICAL Certificate
persisted, retrieved tenant-scoped, BOLA-denied for another tenant, and the row
read straight back via raw SQL from the `incidents` table. Verification rows were
deleted afterward so the real DB is left clean.

**Remaining ops follow-up (NOT done in this code change, pending user
authorization):** provisioning the production Vercel backend
(`backend-three-puce-75`) with the real `DATABASE_URL` / Supabase keys and a
`--prod` redeploy so the *deployed* API persists to Supabase too. That step moves
production secrets and triggers a prod deploy, so it is left for explicit user
sign-off rather than executed from a relayed request. The driver-agnostic code is
ready; serverless should use the session pooler (5432) and mind the free-tier
connection cap.

Operator runbook (already executed locally; repeat on the deploy host once
authorized):

```
# .env already has the real session-pooler DATABASE_URL + Supabase keys.
python -m db.migrate up     # create the 6 tables (idempotent)
python -m db.migrate seed   # seed the demo tenant (idempotent)
```
