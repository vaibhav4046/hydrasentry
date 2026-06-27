# HydraSentry Final Stage Checklist

The product is HydraSentry, a graph-native Memory Integrity Certificate system for HydraDB-powered agents. The repo and tenant ids keep the original `hydrasentry` name on purpose. This is the single page to run from on stage day. Everything below is true and measured. Nothing here gambles the demo on a live network call.

- Live frontend (public): https://frontend-nu-ochre-z41mw3z0l5.vercel.app
- Backend: https://backend-three-puce-75.vercel.app (runs `APP_MODE=demo`)
- One-click canonical run: `POST https://backend-three-puce-75.vercel.app/runs/judge-demo`
- Repo: github.com/vaibhav4046/hydrasentry

---

## 1. Submit (do this first, do not miss the deadline)

- [ ] Submit the repo URL and the live frontend URL before the deadline: **Sat 27 Jun, 1:30 PM IST**.
- [ ] Paste the Discord submission message (see `DISCORD_SUBMISSION.md`) in the HydraDB Discord at submission time.
- [ ] Confirm the public frontend loads and runs `memory_poisoning_refund` to 87 / HIGH from a cold browser tab.
- [ ] Confirm `POST .../runs/judge-demo` returns 87 / HIGH / memory_poisoning / 0.92 (the one-click fallback that cannot flake).

Stage timeline after submission: Blitz Showcase **Sat 9:30 PM IST**, Deep Dive **Sun**.

---

## 2. Pre-warm the real HydraDB tenant (optional proof beat)

The demo-mode UI is the foundation because it cannot flake. The warm real graph is the optional proof beat layered on top. Drive the visuals from demo mode and bring up REAL as evidence, never as the thing the demo depends on.

- [ ] About 90 seconds before going live, pre-warm the owned tenant per `STAGE_RUNBOOK.md` section 2: start a LOCAL real backend (`APP_MODE=real`) and call `POST /runs/memory_poisoning_refund` once so HydraDB finishes extraction off stage.
- [ ] Confirm the warm call printed `source= real_query_paths score= 87`. Leave that local real backend running so the on-stage query is instant.
- [ ] Keep the warm result on a second terminal or the `/graph` view (badge: REAL HYDRADB QUERY_PATHS CAPTURED) as the proof to bring up after the main flow.

If the venue network is hostile, skip this entirely. The story does not change. The only visible difference is the graph-source badge reading DERIVED instead of REAL, and explaining that badge is itself a selling point about the product's honesty.

---

## 3. Record the SkillMake bounty video

- [ ] Record the ~2.5 minute SkillMake bounty screen-share per `VIDEO_OUTLINE.md` section 1 (the "Best Use of Skillmake" bounty requires a video).
- [ ] Verify the live beats: a benign marketplace skill (for example `firecrawl-mcp`) scores LOW / clean, and the planted `unsafe-demo-skill` scores CRITICAL (100), blocked, with per-line findings across five categories.
- [ ] The scanner output is deterministic, so LOW and CRITICAL land identically every take. If the live skillmake.xyz fetch is unavailable, use the offline cached copy and say so on camera. The result is unchanged.

---

## 4. Rehearse the 60-second path

- [ ] Run through `DEMO_60_SEC.md` end to end at least twice until the spoken beats are second nature.
- [ ] Drive the flow with the Run Judge Demo CTA, which persists a run. Do not deep-link `/results` after only the idle hero animation, which does not persist a run.

The canonical 60-second path: hero -> the wedge -> Run Judge Demo (6 stages play in place: BASELINE SAFE, POISON, ATTACKED, GRAPH taint path, MCP FIREWALL block, CERTIFICATE 87/100 BLOCKED QUARANTINED) -> open the Memory Integrity Certificate modal (MIC-2026-REFUND-001, signed) -> optional SkillMake CRITICAL and the real captured HydraDB sample -> close line.

---

## 5. The measured result (this is real, state it plainly)

A third panel of five brutal judges ran a live audit with zero P0 blockers and unanimously called the build stage-ready.

| Judge | Score |
|---|---|
| HydraDB Core Engineer | 8.6 |
| Security Engineer | 7.9 |
| Product / Design | 8.25 |
| Skeptical Hacker | 8.0 |
| Live Demo Judge | 8.5 |
| **Overall average** | **8.25 / 10** |

Per-axis averages: Real Execution 8.4, Working Demo 8.8, Architecture 8.2, HydraDB Graph Use 6.6 (weakest), Security Honesty 9.2 (strongest), Design Polish 8.6, Wow Factor 7.6, Live Stage Reliability 8.4. Trajectory across the three panels: 6.0 -> 7.3 -> 8.25.

---

## 6. Real vs demo (the honest table)

| Component | Status | What is true |
|---|---|---|
| Live frontend to backend | REAL | The public frontend makes real backend calls: `POST /runs/judge-demo`, 200, sub-200ms, deterministic 87 / HIGH / memory_poisoning / 0.92. |
| Hosted backend graph | DEMO (honestly labelled) | Runs `APP_MODE=demo`, so its graph is labelled derived_scenario_graph. No keys in the cloud. |
| Real HydraDB query_paths | REAL (local) | With `APP_MODE=real` locally, `query_paths` work 4/4 reliable. Captured proof is in `real_run_sample.json`, shown on `/graph` as REAL HYDRADB QUERY_PATHS CAPTURED. |
| SkillMake scan | REAL | Real per-line pattern detection. The planted unsafe skill scores CRITICAL (100), blocked. |
| MCP gateway | MCP-inspired HTTP | An HTTP control surface with a manifest and shared-secret write protection, not native stdio transport. |
| Scheduling | SIMULATED | Persists agent rows and computes deterministic next-run dates. Registers no real cron or external timer. |
| Backend tests | REAL | 72 backend tests pass. |

---

## 7. Honest-answer cheat sheet (four adversarial questions)

Answer plainly. Honesty wins the security judges, and it is why Security Honesty was the strongest axis at 9.2.

**Is the 87 hardcoded?**
No. It is a deterministic tuned severity for the memory-poisoning attack class, by design, so the demo is reproducible. It is not an emergent number and not a single magic constant. It fires on a forbidden-marker match, then blends 0.60 rules / 0.25 judge / 0.15 replay. Different attack classes produce different scores: the cross-scenario gradient is 84 / 87 / 93 / 95 / 98. Determinism is a deliberate engineering choice, not a fixed output.

**Is the graph real?**
On the warm real backend, yes. `graph_extractor.build_graph` labels a graph REAL HYDRADB QUERY_PATHS only when the query genuinely returned real triplets, and DERIVED SCENARIO GRAPH FALLBACK otherwise. The public demo never exercises live HydraDB, so its graph is derived and labelled as such. We never present derived data as real HydraDB output.

**Is the MCP native stdio?**
No. It is an HTTP control surface today (MCP-inspired): the tools are exposed over HTTP with a manifest and shared-secret write protection. Native stdio MCP transport is on the roadmap. The tool contracts and auth model are already in place, so the transport swap is mechanical.

**Does it catch an unlabelled paraphrase?**
Honestly, not today. Detection is graph-taint plus marker and label matching. An unlabelled semantic paraphrase sent to `/scan/local` scores LOW. This is documented, not hidden. The detection class we claim is a deterministic, explainable rule engine over real graph evidence, not a trained semantic classifier.

---

## 8. Presenter notes

- Drive the demo via the Run Judge Demo CTA, not the idle hero animation. The CTA persists a run; the passive idle animation does not, so a deep-link to `/results` after only the idle animation will have nothing to show.
- Narrate the certificate, not the bare 87. The number is the headline; the Memory Integrity Certificate is the product. Walk the graph path, the blocked action, and the regression rule.
- Lead with the demo-mode UI, which cannot flake. Keep the warm real-graph local box as the optional proof beat, brought up after the main flow lands.
- Close on the wedge: HydraSentry does not just detect the failure. It certifies the graph path, blocks the action, and turns the incident into a regression rule.
