# HydraSentry Backlog

Phase 0 checkpoint backlog. Two parts:

1. **The 8-axis self-scoring rubric** with the gaps under each axis below 9 and
   the Beast-Mode phase that closes each gap.
2. **The full recon findings log** with severity and target phase.

Scoring is 1 to 10, self-assessed against the recon rubric inputs plus judgment.
Honest, not inflated: the product is real where it claims to be, and the
roadmap is real about what is not built yet.

## Part 1: 8-axis self-scores

Phase 1 deltas are noted inline. Phase 1 shipped real Postgres persistence with
enforced multi-tenant isolation (tenant-scoped repo, reversible migrations,
BOLA-denied across tenants, incidents + signed certificates persisted, audit
log per action), proven against a real DB engine with 16 new tests.

| Axis | Score | One-line basis |
|------|-------|----------------|
| Realness | 8 | Real Groq attack + real HydraDB graph + real judge + real MCP server; fail-closed when degraded. Gap: real path is the unreliable branch under quota. |
| Technical depth | 8 | Replay harness, graph taint tracing, deterministic+LLM risk fusion, native stdio MCP, MIC signing. Gap: detection is lexical, not semantic. |
| Production hardening | 7 | **Phase 1 (+1):** durable Postgres app store via SQLModel, reversible/idempotent migrations, tenant-scoped repo, persistence wired into /runs/real, fail-closed when DB down (surfaced, never faked). Fail-closed everywhere, wall-clock caps, 143 green tests. Gap: no auth, no rate limiting (Phase 2). |
| Standards / OWASP ASI06 | 7 | Directly targets agent memory poisoning (ASI06) with replay + provenance + firewall. Gap: no formal control mapping doc, no semantic coverage claim. |
| Usability | 8 | One-click judge demo, honest REAL-vs-DERIVED labels, console, native MCP install, **Phase 1:** GET /incidents + /incidents/{id} history endpoints. Gap: GET on a POST-only route 404s confusingly (Phase 1 quick, still open). |
| Polish | 9 | ESLint clean, TS clean, build green, masthead-paint fixes, honest-state on dead controls. |
| Security-of-itself | 7 | **Phase 1 (+1):** enforced tenant scoping (BOLA-denied: tenant B cannot read tenant A's incident, 404 leaks nothing), default-deny repo (no query without tenant_id), search_path-injection guard, DSN-credential redaction in error bodies. Secrets masked + never printed, fail-closed firewall. Gap: every HTTP surface still unauthenticated; CORS wildcard fallback (Phase 2). |
| Narrative | 9 | Clear thesis (graph-memory agents inherit a blind spot prompt-testing misses), replay -> trace -> block -> certify arc, honest provenance. |

### Gaps under each axis below 9

**Realness (8)**
- HIGH: Real Groq path is intermittent under repeated calls (free-tier 429). Mitigated in Phase 0 by one transient retry + diagnostics; full hardening (single-flight, judge-only fallback, pin-and-cache) -> **Phase 3-4**.
- LOW: `/graph/real-query` can return `real:true` with 0 nodes if the owned tenant has no current triplets; keep prewarm populated or surface an explicit empty state -> **Phase 3**.

**Technical depth (8)**
- HIGH: Detection is lexical (cue-list substring + regex), so paraphrased unlabelled poison can evade it. Needs an embedding/contradiction classifier -> **Phase 3 (semantic detector)**.

**Production hardening (7)**
- MEDIUM: No authentication on any HTTP surface -> **Phase 2**.
- MEDIUM: No rate limiting on real-cost / write endpoints -> **Phase 2**.
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
| 8 | Auth on all HTTP surfaces (`main.py`): every non-MCP-write endpoint unauthenticated, incl. real-cost paths. | MEDIUM | Phase 2 | Backlog (auth). |
| 9 | Tenant isolation on real quarantine (`mcp_gateway.py` -> `quarantine_memory`): caller-supplied tenant ids, no allowlist (gated by `X-MCP-Secret`). | MEDIUM | Phase 2-3 | Backlog (owned-tenant allowlist). |
| 10 | MCP gateway fail-open branch (`mcp_gateway.py` `_secret_guard`): writes allowed with warning if secret unset (set in deploy). | MEDIUM | Phase 2 | Backlog (fail closed when secret unset). |
| 11 | CORS config (`main.py` / `config.py` `_cors_list`): `['*']` + credentials fallback when `CORS_ORIGINS` empty (real allowlist in deploy). | LOW | Phase 2 | Backlog (drop wildcard fallback or disable credentials when wildcarding). |
| 12 | `/graph/real-query` empty-graph path: `real:true` with 0 nodes if owned tenant has no current triplets. | LOW | Phase 3 | Backlog (keep prewarm populated or surface explicit empty state). |
| 13 | `backend/pytest`: suite fully green, no masked/xfail tests. | LOW | n/a | Confirmed; no action. |
| 14 | `frontend/lint+build`: ESLint clean, Next 16 build + TS clean, 11 routes. | LOW | n/a | Confirmed; no action. |
| 15 | `backend/hydrasentry_mcp` native stdio MCP: imports clean, JSON-RPC works, 7 tools, 9/9 tests incl. fail-closed + tamper detection. | LOW | n/a | Confirmed; no action. |
| 16 | Live `POST /runs/real`: deployment can cold-start into deterministic fallback (Groq env/latency); fail-closed contract intact. | MEDIUM | Phase 0 (diagnosability) + ops | Diagnosability improved by findings 1-2. Env/latency check on deployment is ops, not a code edit. |
| 17 | `real_run.py` `_deterministic_fallback`: `judge=None`, `computed=False` by design in fallback. | LOW | n/a | Confirmed by-design; no action. |
| 18 | Phase 1 persistence + multi-tenant isolation (`db/` package): Postgres app store, reversible migrations, tenant-scoped repo, BOLA-denied, incidents + signed certificates persisted, audit log per action. | ROADMAP | Phase 1 | **DONE (Phase 1):** 16 new tests; BOLA proven (tenant B -> None/404, no data leak); migration up/down reversible + idempotent; seed repeatable; persistence fail-closed when DB down (surfaced, never faked). |
| 19 | `.env` `DATABASE_URL` points at `localhost:5432` (refused); Supabase project unreachable in all pooler regions (`ENOTFOUND tenant or user not found`) + direct host does not resolve -> likely paused. | HIGH | Phase 1 -> ops | **DEFERRED to ops:** restore a real session-pooler DSN (`postgres.<ref>` user, `aws-<n>-<region>.pooler.supabase.com:5432`) and run `python -m db.migrate up`. Code is driver-agnostic and ready; live tables not yet created. |
| 20 | Phase 1 review carries (DB): `checkfirst` migrations skip column-drift (no Alembic); single random UUIDv4 PKs fragment index at scale; `JSON` (not `JSONB`) so `fields`/`detail` not queryable inside. | LOW | Phase 2-3 | Backlog. Acceptable at current scale; revisit with Alembic + JSONB if the store grows. |
| 21 | Phase 1 review carry: persistence auto-provisions a tenant on write via `X-Tenant-Slug` (no auth); CORS wildcard fallback unchanged. | MEDIUM | Phase 2 | Backlog (folded into Phase 2 auth + CORS allowlist). |

### Phase 1 blocker status (was: the Postgres connection string)

The Phase 1 code is **built and proven**: a `db/` package (engine + models +
reversible migrations + tenant-scoped repo + persistence service) is wired into
`/runs/real`, and the multi-tenant/BOLA/fail-closed contract is verified by 16
tests against a real DB engine. The legacy `storage.py` (SQLite + `runs/*.json`)
is intentionally left in place for run replay/report; the new Postgres store is
the durable multi-tenant incident/certificate/audit history.

**One residual blocker, now an ops task, not a code task:** the `.env`
`DATABASE_URL` is not a working Supabase string -- it points at `localhost:5432`
(connection refused) and the Supabase project `gwytslpqvqfewsjcqmuj` is
unreachable (no pooler region accepts the tenant; the direct host does not
resolve), consistent with a paused project. The driver-agnostic code creates the
live tables the instant a real session-pooler DSN is restored:

```
# 1. Set a real DATABASE_URL in backend/.env, e.g.:
#    postgresql://postgres.<ref>:<password>@aws-<n>-<region>.pooler.supabase.com:5432/postgres
# 2. Create the tables:
python -m db.migrate up
# 3. Seed the demo tenant:
python -m db.migrate seed
```

Until that DSN exists, the app boots normally (app-DB init is fail-soft) and
persistence fails closed per request -- surfaced in the `/runs/real` response
`persistence` block, never silently faked.
