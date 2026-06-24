## LIVE LINKS

- GitHub: https://github.com/vaibhav4046/hydrasentry
- Frontend (Vercel, live): https://frontend-nu-ochre-z41mw3z0l5.vercel.app
- Backend: run locally, or deploy with render.yaml (Render Blueprint), then set Vercel env NEXT_PUBLIC_BACKEND_URL to the Render URL and redeploy.

---

# HydraSentry — Submission

**HydraDB Build Blitz hackathon entry.**

A context-integrity harness for AI agents on HydraDB: baseline-vs-poisoned replays, tainted `query_paths` graph forensics, an MCP control surface, a SkillMake verifier, and a continuous self-refining posture.

---

## Links

| Item | URL |
|------|-----|
| GitHub repository | _<PASTE REPO URL>_ |
| Frontend (live) | _<PASTE FRONTEND URL — not deployed yet>_ |
| Backend (live) | _<PASTE BACKEND URL — not deployed yet>_ |
| Demo / SkillMake video | _<PASTE VIDEO LINK>_ |

> No live URLs exist at submission time — the project runs locally. See the run instructions below. Deployment instructions (Vercel + Render) are in `README.md`.

---

## Run it in demo mode (no keys, offline, deterministic)

This is the recommended path for judging. It requires no HydraDB key, no LLM key, and no network.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\Activate.ps1 on Windows
pip install -r requirements.txt
cp .env.example .env          # leave every value blank
uvicorn main:app --port 8000

# Frontend (new terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                    # http://localhost:3000
```

One-click canonical run: `POST http://localhost:8000/runs/judge-demo` returns the full artifact (poisoned-memory replay + SkillMake scan + scheduled scan + self-refinement). The canonical scenario scores 87 / HIGH / confidence 0.92, deterministically.

Tests: `cd backend && pytest` → 44 tests, ~85% coverage.

## Run it against real HydraDB

Set the following in `backend/.env` (gitignored; never commit real keys):

```
APP_MODE=real
HYDRA_DB_API_KEY=<your hydradb key>
HYDRA_DB_API_BASE_URL=https://api.hydradb.com
HYDRA_DB_API_VERSION=2
HYDRA_DB_TENANT_ID=hydrasentry-owned-test
MCP_SHARED_SECRET=<your secret>     # enables MCP write-tool protection
```

With `APP_MODE=real` and a HydraDB key, `RealHydraAdapter` activates: it POSTs to `/context/ingest` and `/query` (with `graph_context: true`), preserves the raw response, and parses `graph_context.query_paths` defensively. When real paths are returned, the graph is labelled REAL HYDRADB QUERY_PATHS; otherwise the derived fallback is used and clearly labelled. Optional LLM providers (Anthropic, Gemini, Groq, OpenRouter, OpenAI, or a local endpoint) can be added by key; with none set, the engine stays deterministic.

---

## Bug-bounty scope note

Bug-bounty mode is **disabled by default**. All built-in scenarios test only tenants and subtenants this app created (`hydrasentry-owned-test`), including both sides of the cross-subtenant leak test. No third-party or production data is touched. Before any bounty testing, official scope must be pasted into `BOUNTY_SCOPE.md`; if it is missing, bounty mode stays disabled. See `BOUNTY_SCOPE.md` for the full safety rules.

---

## Judge scorecard (SELF-ASSESSMENT — not official)

> This table is the team's own self-assessment to structure a conversation. It is **not** an official score and does not represent any judge's opinion. Scores are placeholders out of 10.

| Judge / lens | Innovation | HydraDB use (`query_paths`) | Technical depth | Design | Honesty / completeness | Notes |
|--------------|:---:|:---:|:---:|:---:|:---:|-------|
| Platform / HydraDB | _ /10 | _ /10 | _ /10 | _ /10 | _ /10 | Built around `graph_context.query_paths`; REAL vs DERIVED labelling. |
| Security | _ /10 | _ /10 | _ /10 | _ /10 | _ /10 | 5 attack classes, MCP write protection, owned-tenant-only. |
| Engineering | _ /10 | _ /10 | _ /10 | _ /10 | _ /10 | Adapter pattern, deterministic engine, 44 tests ~85%. |
| Design | _ /10 | _ /10 | _ /10 | _ /10 | _ /10 | Monochrome noir system, 17-component library. |
| Product | _ /10 | _ /10 | _ /10 | _ /10 | _ /10 | Control surface via MCP, CI + scheduled posture. |

---

## Known limitations (stated honestly)

- **Not deployed.** No live URLs; runs locally only.
- **Scheduling is simulated** — six in-app agents persisted in SQLite, no real cron or external timers.
- **No fine-tuning** — the router supports an optional local OpenAI-compatible judge endpoint, but no model is trained.
- **MCP gateway is HTTP (MCP-inspired)**, not a native stdio MCP server.
- **Demo mode is deterministic by design** so the judge demo is reproducible offline; real HydraDB/LLM paths are opt-in.
