# HydraSentry Backlog

Phase 0 checkpoint backlog. Two parts:

1. **The 8-axis self-scoring rubric** with the gaps under each axis below 9 and
   the Beast-Mode phase that closes each gap.
2. **The full recon findings log** with severity and target phase.

Scoring is 1 to 10, self-assessed against the recon rubric inputs plus judgment.
Honest, not inflated: the product is real where it claims to be, and the
roadmap is real about what is not built yet.

## Part 1: 8-axis self-scores

| Axis | Score | One-line basis |
|------|-------|----------------|
| Realness | 8 | Real Groq attack + real HydraDB graph + real judge + real MCP server; fail-closed when degraded. Gap: real path is the unreliable branch under quota. |
| Technical depth | 8 | Replay harness, graph taint tracing, deterministic+LLM risk fusion, native stdio MCP, MIC signing. Gap: detection is lexical, not semantic. |
| Production hardening | 6 | Fail-closed everywhere, wall-clock caps, 95 green tests, CI now gating. Gap: no auth, no rate limiting, SQLite-only persistence. |
| Standards / OWASP ASI06 | 7 | Directly targets agent memory poisoning (ASI06) with replay + provenance + firewall. Gap: no formal control mapping doc, no semantic coverage claim. |
| Usability | 8 | One-click judge demo, honest REAL-vs-DERIVED labels, 11-route console, native MCP install. Gap: GET on a POST-only route 404s confusingly. |
| Polish | 9 | ESLint clean, TS clean, build green, masthead-paint fixes, honest-state on dead controls. |
| Security-of-itself | 6 | Secrets masked + never printed, fail-closed firewall, structurally-safe unauth path. Gap: every HTTP surface unauthenticated; fail-open-if-secret-unset; CORS wildcard fallback. |
| Narrative | 9 | Clear thesis (graph-memory agents inherit a blind spot prompt-testing misses), replay -> trace -> block -> certify arc, honest provenance. |

### Gaps under each axis below 9

**Realness (8)**
- HIGH: Real Groq path is intermittent under repeated calls (free-tier 429). Mitigated in Phase 0 by one transient retry + diagnostics; full hardening (single-flight, judge-only fallback, pin-and-cache) -> **Phase 3-4**.
- LOW: `/graph/real-query` can return `real:true` with 0 nodes if the owned tenant has no current triplets; keep prewarm populated or surface an explicit empty state -> **Phase 3**.

**Technical depth (8)**
- HIGH: Detection is lexical (cue-list substring + regex), so paraphrased unlabelled poison can evade it. Needs an embedding/contradiction classifier -> **Phase 3 (semantic detector)**.

**Production hardening (6)**
- MEDIUM: No authentication on any HTTP surface -> **Phase 2**.
- MEDIUM: No rate limiting on real-cost / write endpoints -> **Phase 2**.
- ROADMAP: SQLite + `runs/*.json` only; no durable multi-node store -> **Phase 1 (Supabase/Postgres)**.

**Standards / OWASP ASI06 (7)**
- Gap: No explicit ASI06 control-mapping document tying each engine component to the standard; semantic-coverage limitation not yet framed against the standard -> **Phase 3-4 (docs + semantic detector)**.

**Usability (8)**
- LOW: `GET /runs/judge-demo` 404s (route is POST); add a GET alias or document the method -> **Phase 1 (quick)**.

**Security-of-itself (6)**
- MEDIUM: All HTTP surfaces unauthenticated, including real-cost paths -> **Phase 2**.
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

### Single biggest Phase 1 blocker

The durable **Supabase Postgres connection string** (`DATABASE_URL` / pooled
`POSTGRES_PRISMA_URL` style). Everything in Phase 1 (history persistence,
multi-node state, the user/tenant records that Phase 2 auth attaches to) is
blocked on standing up that database and wiring `storage.py` from SQLite +
`runs/*.json` to Postgres. Until that connection string exists, persistence stays
single-node and ephemeral on serverless `/tmp`.
