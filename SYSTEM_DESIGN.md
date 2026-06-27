# HydraSentry System Design

The architecture of HydraSentry as it ships today: a graph-native Memory
Integrity Certificate system wrapped in a multi-tenant SaaS for HydraDB-powered
agents. This document marks what is **REAL today** (shipping in the deployed
product, exercised by the test suite) versus **ROADMAP** (named per component).

The guiding rule of the project holds here: nothing in the value path is faked,
and every degraded state is honestly labelled. This document holds the same line.

- Frontend (live, public): https://frontend-nu-ochre-z41mw3z0l5.vercel.app
- Backend (live): https://backend-three-puce-75.vercel.app
- Repo: https://github.com/vaibhav4046/hydrasentry

## 1. Architecture (as shipped)

```
                Browser (Next.js 16 console: public demo + /console app)
                                      |
                                  HTTPS / CORS
                                      |
              +-----------------------v------------------------+
              |        FastAPI API  (backend/main.py)          |
              |  current_identity:                             |  REAL
              |   X-API-Key  -> per-user key (hs_live_, hashed) |
              |   Bearer JWT -> Supabase magic-link session     |
              |   neither    -> shared public demo tenant       |
              |  default-deny: present-but-invalid -> 401       |  REAL
              +-----------------------+------------------------+
                                      |
              +-----------------------v------------------------+
              |              Security engine                   |
              |  - Replay harness    (clean vs poisoned)       |  REAL
              |  - Graph tracer      (query_paths taint)       |  REAL
              |  - Risk judge        (rules + Groq judge)      |  REAL
              |  - Semantic detector (Gemini embeddings)       |  REAL
              |  - MCP firewall      (gateway, fail-closed)    |  REAL
              |  - MIC signer        (HMAC certificate)        |  REAL
              +------+----------------+-----------------+------+
                     |                |                 |
        +------------v---+   +--------v-------+  +------v-----------+
        | Postgres app   |   | HydraDB graph  |  | Native stdio MCP |
        | store (Supabase)|  | memory (real)  |  | server (real)    |
        | REAL, tenant-   |  | REAL           |  | REAL, 7 tools    |
        | isolated, BOLA  |  |                |  |                  |
        +----------------+   +----------------+  +------------------+
```

The console drives a FastAPI API. The API resolves a caller to a tenant, then
fronts a security engine whose components run a clean-vs-poisoned replay, trace
the poison through HydraDB retrieval paths, score it (deterministic rules plus a
real Groq judge), catch reworded poison with real Gemini embeddings, block the
resulting action at an MCP firewall, and seal the run into a Memory Integrity
Certificate. Persistent application state lives in Postgres (Supabase), isolated
per tenant. Agent memory lives in HydraDB. A native stdio MCP server exposes the
same real tools to any MCP client.

## 2. Auth and multi-tenancy (REAL)

Every request resolves to exactly one tenant through `current_identity`
(`backend/auth/identity.py`), in this strict order:

1. **`X-API-Key` present** -> resolve to the key's user and personal tenant, or
   **401** if the key is unknown or revoked. A presented key is never ignored.
2. **`Authorization: Bearer <jwt>` present** -> verify the Supabase access token
   against the project JWKS (ES256/RS256 public key, no secret) with a legacy
   HS256 fallback, enforcing `iss`, `aud=authenticated`, and `exp`; resolve to
   the user's personal tenant, or **401** if forged, expired, or wrong project.
3. **Neither credential** -> the shared public `demo` tenant (the showcase).

The default-deny nuance: the *absence* of credentials falls to demo, but a
*present-but-invalid* credential is a hard 401, never a silent demo downgrade.
That is what stops an attacker fishing for behavior with a forged token while
keeping the public demo open. User-data endpoints (`/auth/sync`, `/api-keys*`)
add `require_user`, which 401s anything that is not a verified Supabase user
(an API-key agent cannot mint or list the human's keys).

- **Supabase magic-link auth** (`auth/jwt_verifier.py`): JWKS verification,
  fail-closed on every error path. The web session is a real email magic-link
  click; tokens are verified server-side.
- **Per-user API keys** (`auth/api_keys.py`): shaped `hs_live_<43 url-safe
  chars>` (256 bits). The raw key is shown **once** at creation and never
  stored; only a **salted SHA-256** `key_hash` plus an 8-char display prefix are
  persisted. Verification re-hashes and constant-time compares.
- **Tenant isolation / BOLA defense** (`db/repo.py`): every domain read and
  write **requires** a `tenant_id` and filters on it. `get(tenant_id, row_id)`
  returns `None` when the row exists but belongs to another tenant, and the API
  collapses that to 404 so cross-tenant probing leaks nothing. There is no repo
  method that touches a domain table without a tenant predicate.
- **Connect-your-agent**: an API-key-authenticated run (`/runs/real`) persists
  to that key's user tenant via `persist_run_for_tenant`, and `/incidents` lists
  by the same tenant. So a remote agent's poisoned-memory incidents flow into
  its owner's private dashboard.

## 3. Data model (REAL)

SQLModel tables in `db/models.py`, UUID string PKs so the identical schema runs
on Postgres and on the offline sqlite test driver.

| Table | Purpose | Tenant scoping |
|-------|---------|----------------|
| `tenants` | The tenancy boundary; all domain data scopes to one tenant. | root |
| `users` | Identity; `supabase_sub` (verified JWT `sub`) is the stable get-or-create key, linked to a personal tenant. | -> tenant |
| `api_keys` | Per-user keys; `key_hash` (salted SHA-256, unique), `prefix`, `revoked_at`. Raw key never stored. | -> tenant + user |
| `incidents` | A persisted run: baseline vs poisoned answers, risk score, band, decision, attack type, graph source, mode. | -> tenant |
| `certificates` | A Memory Integrity Certificate bound to a blocked/high-risk incident; `mic_id`, `hmac_sig`, `fields` (JSON). | -> tenant + incident |
| `regression_rules` | A detection signature registered after an accepted finding. | -> tenant |
| `audit_logs` | Append-only, one row per tenant-scoped action (list, get, denied get). | -> tenant |

Migrations (`db/migrate.py`) are a reversible, idempotent runner (no Alembic):
`up` creates every table FK-ordered with `checkfirst`, `down` drops them in the
exact inverse order, `reset` round-trips to a clean seeded state, `seed`
idempotently provisions the `demo` tenant. Current version
`0002_api_keys_and_user_sub`. Each command prints compact JSON and exits non-zero
on failure, so CI or an operator can gate on it. Secrets are never printed.

## 4. Security engine (REAL)

| Component | Module | Status | Evidence |
|-----------|--------|--------|----------|
| Real Groq attack run | `real_run.py`, `real_agent.py` | REAL | `POST /runs/real` runs two parallel Groq agents (clean -> escalate, poisoned false-policy -> auto-approve GBP 900) + a real Groq judge (computed CRITICAL/90). Fail-closed to deterministic 87/HIGH on any failure, always HTTP 200. |
| Real HydraDB graph query | `real_graph.py`, `hydra_client.py` | REAL | `GET /graph/real-query` returns `ok:true, real:true, graph_source:real_query_paths` from a live owned HydraDB tenant. |
| Replay harness | `scenario_engine.py`, `agent_runner.py` | REAL | Baseline vs poisoned replay over the same task; the behavior diff is computed, not asserted. |
| Graph tracer (taint) | `graph_extractor.py` | REAL | Builds nodes/edges/`query_paths` and the tainted path `mem_poison -> policy` from real or derived context, labelled honestly. |
| Risk judge (rules + LLM) | `risk_engine.py`, `real_agent.judge_answers` | REAL | Bands LOW<40, MEDIUM 40-69, HIGH 70-89, CRITICAL>=90; score = 0.60 rules + 0.25 judge + 0.15 replay. Canonical demo 87/HIGH/0.92, deterministic, no keys needed. |
| Semantic detector | `semantic_detector.py` | REAL | Real Gemini `gemini-embedding-001` embeddings: fires when a memory's max cosine to a curated poison signature clears 0.74 and is at least as close as to a benign anchor. Catches reworded poison the lexical cue list misses. Fail-closed to lexical when the key/endpoint is unavailable. Each accepted finding can be added as a regression signature. |
| MCP firewall (HTTP gateway) | `mcp_gateway.py` | REAL (fail-closed in deploy) | Write tools 401 without `X-MCP-Secret`; the secret is set in deploy. |
| MIC signer | `hydrasentry_mcp/certificate.py` | REAL | HMAC certificate over a scan; tamper detection verified by `test_mcp_server.py`. |
| Native stdio MCP server | `hydrasentry_mcp/` | REAL | JSON-RPC `initialize` + `tools/list` advertise 7 real tools with schemas; tests cover fail-closed query-without-key. |
| Local content scan | `adapters/local_scan.py` | REAL | `POST /scan/local`, in-memory adapter, no network. Lexical content signal plus the semantic detector. |
| SkillMake scanner | `skillmake_scanner.py` | REAL (regex) | Ten-category static `SKILL.md` scan; `POST /skillmake/scan-url` pulls a real marketplace skill server-side. |
| Self-refinement loop | `self_refiner.py` | REAL (deterministic) | Each accepted finding becomes a regression rule so the same poison cannot reach the agent twice. |
| Scheduler | `scheduler.py` | REAL (simulated schedule) | Continuous scheduled posture runs, persisted; an in-app simulated schedule, not OS cron. |

## 5. Request and auth flow (the loop that runs today)

```
Browser /console
   -> sign in (Supabase magic-link email click)
   -> POST /auth/sync (verify JWT, get-or-create user + personal tenant)
   -> POST /api-keys  (mint hs_live_ key, raw shown ONCE)        [JWT only]

Agent / MCP client
   -> X-API-Key: hs_live_...  resolves to the owner's tenant

Any caller -> FastAPI -> current_identity -> tenant
   -> Scenario Engine -> {
        HydraDB adapter (Real / Demo),
        Agent Runner (replay),
        Risk Engine (rules + Groq judge + replay),
        Semantic Detector (Gemini embeddings, reworded poison),
        Graph Extractor (taint),
        MCP Firewall (block),
        MIC Signer (certificate),
        Self-Refiner (regression rule),
        Scheduler (continuous posture)
      }
   -> persist_run_for_tenant(result, identity.tenant_id)   [Postgres, tenant-scoped]
   -> GET /incidents, GET /incidents/{id}                   [tenant-scoped, BOLA 404]
```

The real attack path (`/runs/real`) adds two parallel real HydraDB sub-tenant
queries (clean + poisoned), two parallel real Groq agents, a real Groq judge, a
real risk score, and a real graph. It fail-closes to the deterministic 87/HIGH
stand-in on any HydraDB / Groq / wall-clock failure, always HTTP 200, always
labelled. Persistence is fail-closed too: if the app DB is down the run still
returns with a `persistence` block surfacing the error, never silently faked.

## 6. Deployment

- **Frontend (Vercel)** built from `frontend/`. `NEXT_PUBLIC_BACKEND_URL` points
  at the backend. The console talks to the Supabase project for the magic-link
  session and to the backend for all data.
- **Backend (Vercel)** running `APP_MODE=demo` for the public showcase, with
  Supabase (Postgres + auth JWKS) and Gemini embeddings configured so auth,
  per-tenant persistence, and semantic detection are live. `render.yaml` is also
  provided as a Render Blueprint alternative.
- **Postgres (Supabase)** holds tenants, users, api_keys, incidents,
  certificates, regression_rules, audit_logs. Migrations are run via
  `python -m db.migrate up`.

## 7. Honest limits (REAL-vs-roadmap residue)

- **The hosted public demo persists to a shared `demo` tenant.** Unauthenticated
  showcase runs land there by design; per-user isolation applies once you sign
  in or present an API key.
- **Magic-link needs a real email click.** The Supabase auth round-trip is real,
  so the authenticated path cannot be driven from a cold tab without that click.
- **The deterministic `/runs/judge-demo` is the fail-closed fallback** (clearly
  labelled). Real HydraDB / Groq paths are strictly opt-in and never required.
- **The MCP gateway is HTTP (MCP-inspired); the native one is the stdio server**
  (`hydrasentry-mcp`). Both wrap the same real tools.
- **HydraDB and Groq run on free tiers**, so a heavy burst can drop the real
  path to the deterministic fallback (labelled), never to a fabricated result.
- **Semantic detection is similarity-to-signatures plus regression-add, not a
  trained classifier.** It is capped per band and never overrides the
  deterministic canonical demo.

## 8. Roadmap

- Real scheduled execution (replace the simulated scheduler with a real runner).
- Rate limiting on real-cost and write endpoints (wall-clock caps bound per-call
  cost today, not request volume).
- Persist semantic signature embeddings to Postgres (text store re-embedded on
  load today).
- Property-graph backends (Neo4j / Memgraph) behind the same `HydraAdapter` ABC.
