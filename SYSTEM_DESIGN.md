# HydraSentry System Design

Target architecture for HydraSentry, the memory-and-knowledge-layer red-team and
runtime firewall for graph-memory agents. This document marks what is **REAL
today** (shipping in the deployed product, exercised by the 95-test suite) versus
**ROADMAP** (Beast-Mode phases 1 to 4, pending a Supabase application DB).

The guiding rule of the project holds here too: nothing in the value path is
faked, and every degraded state is honestly labelled. This document is honest
about the same line.

## 1. Target architecture (end state)

```
                          Browser (Next.js 16 console)
                                      |
                                  HTTPS / CORS
                                      |
              +-----------------------v------------------------+
              |        FastAPI API  (backend/main.py)          |
              |  authn (API key / origin)  +  tenant context   |  <-- authn/tenant = ROADMAP (Phase 1-2)
              |  rate limiting on real-cost + write endpoints   |  <-- ROADMAP (Phase 2)
              +-----------------------+------------------------+
                                      |
              +-----------------------v------------------------+
              |              Security engine                   |
              |  - Replay harness   (clean vs poisoned)        |  REAL
              |  - Graph tracer     (query_paths taint)        |  REAL
              |  - Risk judge       (rules + Groq judge)       |  REAL
              |  - Semantic detector (embedding/contradiction) |  ROADMAP (Phase 3)
              |  - MCP firewall     (gateway, fail-closed)     |  REAL
              |  - MIC signer       (HMAC certificate)         |  REAL
              +------+----------------+-----------------+------+
                     |                |                 |
        +------------v---+   +--------v-------+  +------v-----------+
        | Postgres app   |   | HydraDB graph  |  | Native stdio MCP |
        | store (Supabase)|  | memory (real)  |  | server (real)    |
        | ROADMAP Phase 1 |  | REAL           |  | REAL             |
        +----------------+   +----------------+  +------------------+
```

The console drives a FastAPI API. The API fronts a security engine whose
components run a clean-vs-poisoned replay, trace the poison through HydraDB
retrieval paths, score it (deterministic rules plus a real LLM judge), block the
resulting action at an MCP firewall, and seal the run into a Memory Integrity
Certificate. Persistent application state lives in Postgres (Supabase). Agent
memory lives in HydraDB. A native stdio MCP server exposes the real tools to any
MCP client.

## 2. What is REAL today

These are shipping in the deployed backend (`backend-three-puce-75.vercel.app`)
and frontend (`frontend-nu-ochre-...vercel.app`), and are covered by the
95-passing pytest suite.

| Component | Module | Status | Evidence |
|-----------|--------|--------|----------|
| Real Groq attack run | `real_run.py`, `real_agent.py` | REAL | `POST /runs/real` runs two parallel Groq agents (clean -> escalate, poisoned false-policy -> auto-approve GBP 900) + a real Groq judge (computed CRITICAL/90). Fail-closed to deterministic 87/HIGH on any failure. |
| Real HydraDB graph query | `real_graph.py`, `hydra_client.py` | REAL | `GET /graph/real-query` returns `ok:true, real:true, graph_source:real_query_paths` from a live owned HydraDB tenant. |
| Replay harness | `scenario_engine.py`, `agent_runner.py` | REAL | Baseline vs poisoned replay over the same task; behavior diff is computed, not asserted. |
| Graph tracer (taint) | `graph_extractor.py` | REAL | Builds nodes/edges/`query_paths` and the tainted path `mem_poison -> policy` from real or derived context. |
| Risk judge (deterministic + LLM) | `risk_engine.py`, `real_agent.judge_answers` | REAL | Bands LOW<40, MEDIUM 40-69, HIGH 70-89, CRITICAL>=90; score = 0.60 rules + 0.25 judge + 0.15 replay. Canonical demo 87/HIGH/0.92, deterministic, no keys needed. |
| MCP firewall (HTTP gateway) | `mcp_gateway.py` | REAL (fail-closed in deploy) | Write tools 401 without `X-MCP-Secret`; verified. Default-deny posture present (see backlog: fail-open-when-unset hardening). |
| MIC signer | `hydrasentry_mcp/certificate.py` | REAL | HMAC certificate over a scan; tamper detection verified by `test_mcp_server.py`. |
| Native stdio MCP server | `hydrasentry_mcp/` | REAL | JSON-RPC initialize + tools/list advertise 7 real tools with schemas; 9/9 tests green incl. fail-closed query-without-key. |
| Local content scan | `adapters/local_scan.py` | REAL (lexical) | `POST /scan/local` hardcodes tenant `local-owned`, in-memory adapter, no network. Thin lexical content signal lifts override+action wording to MEDIUM. |
| SkillMake static scanner | `skillmake_scanner.py` | REAL (regex) | Regex-based skill scanning; quarantines blatant exfil. Coverage limits documented (see backlog). |
| Self-refinement loop | `self_refiner.py` | REAL (deterministic) | Each accepted finding becomes a regression rule so the same poison cannot reach the agent twice. |
| Scheduler | `scheduler.py` | REAL | Continuous scheduled posture runs. |

Persistence today is **SQLite + `runs/*.json`** (`storage.py`), not Postgres. It
works and is honest, but it is single-node and ephemeral on serverless (`/tmp`).
Postgres/Supabase is the Phase 1 upgrade.

## 3. What is ROADMAP (and which phase closes it)

| Capability | Status | Phase | Note |
|------------|--------|-------|------|
| Postgres / Supabase application store | ROADMAP | Phase 1 | Replace SQLite + `runs/*.json` with a durable multi-node store. Unblocks tenancy + history + auth user records. |
| API authentication (API key / origin) | ROADMAP | Phase 2 | Every HTTP surface is currently unauthenticated, including real-cost `/runs/real` and `/graph/real-query`. |
| Rate limiting (real-cost + write) | ROADMAP | Phase 2 | Wall-clock caps bound per-call cost but not request volume. |
| Owned-tenant allowlist on writes | ROADMAP | Phase 2-3 | `quarantine_memory` trusts caller-supplied tenant ids (gated only by `X-MCP-Secret` today). |
| MCP gateway fail-closed when secret unset | ROADMAP | Phase 2 | Currently fail-open with a warning if `MCP_SHARED_SECRET` is unset (set in deploy, so closed in practice). |
| Semantic / embedding detector | ROADMAP | Phase 3 | Detection is lexical today; paraphrased unlabelled poison can evade the cue list. The headline limitation; needs an embedding/contradiction classifier. |
| Groq quota hardening (single-flight, judge-only fallback, pin-and-cache) | ROADMAP | Phase 3-4 | Reduce the chance a demo burst drops the real path. Partly mitigated in Phase 0 (retry + diagnostics). |
| CORS wildcard fallback removal | ROADMAP | Phase 2 | Drop the `['*']` + credentials fallback; current deploy uses a real allowlist. |

## 4. Data flow (the loop that runs today)

```
Frontend -> FastAPI -> Scenario Engine -> {
    HydraDB adapter (Real / Demo),
    Agent Runner (replay),
    Risk Engine (rules + judge + replay),
    Graph Extractor (taint),
    MCP Firewall (block),
    MIC Signer (certificate),
    Self-Refiner (regression rule),
    Scheduler (continuous posture)
} -> Storage (SQLite + runs/*.json)   [Postgres in Phase 1]
```

The real attack path (`/runs/real`) adds: two parallel real HydraDB sub-tenant
queries (clean + poisoned) -> two parallel real Groq agents -> real Groq judge ->
real risk score -> real graph. Fail-closed to the deterministic 87/HIGH stand-in
on any HydraDB / Groq / wall-clock failure, always HTTP 200, always labelled.

## 5. Phase 0 hardening applied (this checkpoint)

- `real_agent._groq_chat` now retries once on a transient status (429/5xx),
  honouring `Retry-After`, so a single demo burst recovers instead of silently
  dropping to the deterministic vector.
- Groq failures are now diagnosable: the API `fallback_reason` carries the
  upstream cause (e.g. `groq agent produced no answer (groq 429 rate_limited)`)
  instead of an opaque "no answer". Distinguishes 429 quota / 401 auth /
  404 model-not-found / 5xx / transport / no-key in seconds.
- CI gate (`.github/workflows/ci.yml`): backend pytest (Python 3.13) + frontend
  `npm ci` + lint + build on every push/PR to main.
