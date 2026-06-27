# HydraSentry Ship Checklist (Phase 7)

The final ship gate. Each item is marked **DONE** with verifiable evidence, or
flagged with an honest status. Nothing here is aspirational: a DONE means it
ships in the deployed product and is exercised by the suite or reproducible
against the live URLs.

- Frontend (public): https://frontend-nu-ochre-z41mw3z0l5.vercel.app
- Backend: https://backend-three-puce-75.vercel.app
- Repo: https://github.com/vaibhav4046/hydrasentry

---

## Rubric axes

| Axis | Status | Evidence |
|------|--------|----------|
| Real value path (a real model fooled, scored, traced, blocked, certified) | **DONE** | `POST /runs/real` runs real Groq llama-4-scout agents (clean vs poisoned false-policy), a real Groq judge, real risk score, real graph; fail-closes to 87/HIGH labelled. Canonical floor `POST /runs/judge-demo` -> 87 / HIGH / 0.92. |
| Graph-native evidence | **DONE** | `GET /graph/real-query` returns `graph_source: real_query_paths` from a live owned HydraDB tenant; taint path traced; REAL vs DERIVED labelled in `graph_extractor.py` / `report.py`. |
| Multi-tenant SaaS | **DONE** | Supabase magic-link auth, per-user `hs_live_` keys, per-tenant Postgres persistence, `/console` web app, connect-your-agent. See tenancy row below. |
| Semantic detection | **DONE** | `semantic_detector.py` uses real Gemini `gemini-embedding-001` embeddings; catches reworded poison; fail-closed to lexical. |
| Native MCP | **DONE** | `hydrasentry-mcp` stdio server, 7 real tools, JSON-RPC, installs clean, fails closed without keys. |
| Honesty / provenance | **DONE** | Every degraded state labelled; derived never presented as real; limits documented in README and SYSTEM_DESIGN. |

## Tests and CI

- [x] **Backend suite green.** **DONE.** `153` tests collected; `147 passed,
  6 skipped` offline (`HYDRASENTRY_SEMANTIC_DETECTION=0`, Python 3.13). The 6
  skips are the live Gemini-embeddings cases that require a real key; they run
  when the key is present. No failures.
- [x] **CI configured.** **DONE.** `.github/workflows/ci.yml` runs backend
  pytest (Python 3.13) plus frontend `npm ci` + lint + production build on every
  push and PR to main, with concurrency cancellation.
- [x] **Reversible, idempotent migrations.** **DONE.** `db/migrate.py` `up` /
  `down` / `reset` / `seed` / `status`; `down` is the exact inverse of `up`;
  version `0002_api_keys_and_user_sub`; exits non-zero on failure for CI gating.
- [x] **Self-red-teamed each phase.** **DONE.** Default-deny auth (present-but-
  invalid -> 401, never demo), BOLA gate (cross-tenant -> 404), fail-closed
  persistence and real paths. Tracked in `BACKLOG.md`.

## Production deployment

- [x] **Frontend deployed + verified.** **DONE.** Live and public; hero +
  `/console` load; Run Judge Demo reaches 87 / HIGH from a cold tab.
- [x] **Backend deployed + verified.** **DONE.** Live; `POST /runs/judge-demo`
  returns the full canonical artifact deterministically; `GET /health` OK.
- [x] **Postgres (Supabase) live.** **DONE.** Tenants, users, api_keys,
  incidents, certificates, regression_rules, audit_logs; migrations applied.
- [x] **Supabase auth (JWKS) configured.** **DONE.** `/auth/sync` verifies a
  real Supabase access token; forged/expired -> 401.

## Live attack reproducible

- [x] **One-click canonical run.** **DONE.** `POST /runs/judge-demo` -> 87 /
  HIGH / memory_poisoning / 0.92, no keys, no network, every time.
- [x] **Real attack path.** **DONE.** `POST /runs/real` exercises the real Groq
  agents + judge when keys are present; fail-closes to the deterministic floor
  labelled `mode: deterministic_fallback`, always HTTP 200.
- [x] **Graph taint visible.** **DONE.** `mem_poison_047 -> policy_refund_v2 ->
  instant_refund_action -> manager_approval`, with the honest source badge.

## MCP

- [x] **Installs clean.** **DONE.** `pip install -e .` provides `hydrasentry-mcp`
  (and `python -m hydrasentry_mcp`); JSON-RPC `initialize` + `tools/list`
  advertise 7 real tools with schemas; no MCP SDK required, works offline.
- [x] **Fails closed without a key.** **DONE.** Key-gated tools
  (`query_memory_graph`, `run_memory_attack`) return an honest "key required"
  message; they never fabricate a result. Covered by `test_mcp_server.py`.

## Auth and tenant isolation (red-teamed)

- [x] **Supabase magic-link auth.** **DONE.** Real email magic-link session;
  server-side JWKS verification, fail-closed on every error path.
- [x] **Per-user API keys.** **DONE.** `hs_live_<43 chars>` (256-bit), salted
  SHA-256 hash + 8-char prefix stored, raw shown ONCE, constant-time verify,
  revocable. `auth/api_keys.py`, `test_auth.py`.
- [x] **Tenant isolation / BOLA.** **DONE.** `db/repo.py` requires a `tenant_id`
  on every domain op; cross-tenant row invisible; API returns 404 for a
  cross-tenant fetch so probing leaks nothing. `test_db_tenancy.py`.
- [x] **Default-deny.** **DONE.** No credential -> demo tenant; present-but-
  invalid credential -> hard 401; user-data endpoints require a real Supabase
  user (an API-key agent cannot mint/list the human's keys).
- [x] **Connect-your-agent.** **DONE.** An API-key run persists to the key's user
  tenant; `/incidents` lists by that tenant; the agent's incidents reach the
  owner's private dashboard.

## Semantic detector (paraphrase)

- [x] **Catches reworded poison.** **DONE.** Real Gemini embeddings; a paraphrase
  that trips no lexical cue still fires on cosine similarity to a poison
  signature, gated by benign anchors. `semantic_detector.py`,
  `test_semantic_detector.py`.
- [x] **Fails closed.** **DONE.** No key / endpoint error ->
  `available: False` with a transparent reason; caller falls back to lexical and
  labels it. Never a fabricated score.

## Submission docs

- [x] **README.md** **DONE** (product pitch, problem + citations, demo flow,
  architecture, REAL-vs-ROADMAP, local run, deployment, limitations, judge
  notes, connect-your-agent quickstart, OWASP ASI06 mapping).
- [x] **SYSTEM_DESIGN.md** **DONE** (full SaaS architecture: auth, multi-tenancy,
  persistence, security engine, MCP server, data model, request/auth flow,
  REAL-vs-roadmap per component).
- [x] **LIVE_SCRIPT.md** **DONE** (90-second live attack, connect-your-agent
  beat, Sunday deep-dive, adversarial Q&A).
- [x] **VIDEO_OUTLINE.md** **DONE** (live-attack video + Skillmake bounty video,
  reflecting the real SaaS).
- [x] **SHIP_CHECKLIST.md** **DONE** (this file).

---

## Honest-pending (not blockers, stated plainly)

- **Public demo persists to a shared `demo` tenant.** Per-user isolation kicks in
  on sign-in or API key. By design for the open showcase.
- **Magic-link needs a real email click.** The auth round-trip is real, so the
  authenticated path needs that click; the public demo path does not.
- **Scheduler is a simulated schedule.** Persisted in the app store; not OS cron.
  Roadmap: a real runner.
- **Rate limiting on real-cost / write endpoints is roadmap.** Wall-clock caps
  bound per-call cost today, not request volume.
- **Semantic signatures are a text store re-embedded on load.** Persisting
  embeddings to Postgres is a later phase.
- **HydraDB + Groq free tiers.** A heavy burst can drop the real path to the
  deterministic fallback (labelled), never to a fabricated result.
- **Serverless persistence for the public backend can reset on redeploy.** The
  deterministic demo does not depend on prior state.

## Summary

All rubric axes, tests + CI, production deployment, live-attack reproducibility,
MCP install + fail-closed, auth + tenant isolation, semantic detection, and the
four submission docs are **GREEN**. The honest-pending list is degradation and
roadmap, each labelled in product and never faked. Ship.
