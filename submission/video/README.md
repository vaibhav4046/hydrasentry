# HydraSentry / Constellan demo video package

Everything needed to ship and re-shoot the HydraDB Build Blitz demo video. Two
finished MP4s, the captions, the stills, the poster, and the full shot script
with the description and titles. The honesty rule holds throughout: nothing in
the value path is mocked, and every real-vs-derived state is labelled on screen.

- Frontend (public): https://frontend-nu-ochre-z41mw3z0l5.vercel.app
- Backend: https://backend-three-puce-75.vercel.app
- Console (the SaaS): https://frontend-nu-ochre-z41mw3z0l5.vercel.app/console
- Live graph query: https://frontend-nu-ochre-z41mw3z0l5.vercel.app/graph

---

## Primary deliverable

**`constellan_screencap.mp4` is the primary video.** It is a real-UI capture of
the live product: headless Chrome driving the live Vercel frontend and backend
(backend verified healthy, mode=demo), with the "Run live attack" button really
clicked and the live Groq result rendered in place. This is the cut to submit,
because every frame is the actual deployed product, not an animation.

**`constellan_film.mp4` is the polished companion.** It is a Remotion render
(noir/monochrome motion design) of the same story across eight scenes, ending on
the signed Memory Integrity Certificate and the REPLAY / TRACE / BLOCK / CERTIFY
wordmark. Use it as a title-card opener, a fallback if a screen capture stutters,
or a higher-production b-roll cut. It is rendered art, not a live capture, and is
labelled as such.

Both tell the same true story (refund agent on HydraDB memory, poisoned policy,
87 / HIGH deterministic vs ~90 / CRITICAL live Groq, query_paths taint chain, MCP
firewall block, signed certificate). Pick the screen capture as the headline
submission; attach the Remotion film as the cinematic version.

---

## Asset index

### Video (verified with ffprobe)

| File | Kind | Duration | Resolution | Codec / fps | Size | Notes |
|------|------|----------|------------|-------------|------|-------|
| `constellan_screencap.mp4` | Real-UI screen capture (PRIMARY) | 43.67s | 1920x1080 | h264 / 12fps | ~3.9 MB | Live frontend + live backend, "Run live attack" really clicked, live Groq CRITICAL result, /graph live HydraDB query, /mcp firewall block, /console incidents. |
| `constellan_film.mp4` | Remotion render (companion) | 70.06s | 1920x1080 | h264 / 30fps | ~10.8 MB | 8-scene noir motion film of the same story; ends on signed certificate + moat strip + REPLAY · TRACE · BLOCK · CERTIFY wordmark. |

Both MP4s verified: duration > 0, one h264 video stream, 1920x1080. Both play.

### Captions

- `captions.srt` - 12 cues, ~0:00 to ~2:00, matching the 90-second beat table
  narration. No em dashes, no Claude/Anthropic references.

### Poster / thumbnail

- `poster.png` - full-res (3840x2160) frame of the verified Memory Integrity
  Certificate (`05_memory_certificate.png`). The strongest single proof frame:
  MIC-2026-REFUND-001, risk 87/100, DECISION BLOCKED, signed seal.
- `thumbnail.png` - 1280x720 letterboxed version of the same certificate frame,
  for YouTube/Discord thumbnails.

### Stills (9 PNGs, 3840x2160 = 1920x1080 logical @ 2x device scale)

All captured from the live product via headless Chrome + Chrome DevTools Protocol.

| File | What it shows |
|------|---------------|
| `stills/01_landing_hero.png` | Observatory star-chart hero, "Run live attack" CTA, live metrics, pipeline rail. |
| `stills/02_run_result_87_high.png` | Run result card, top badge 87 / HIGH (deterministic floor). |
| `stills/02b_live_run_poisoned_vs_clean.png` | Live /runs/real outcome: real Groq llama-4-scout, 90/100 CRITICAL, poisoned answer vs certified poisoned memory. |
| `stills/03_query_paths_graph.png` | /graph live HydraDB query_paths constellation, tainted path traced, "LIVE QUERY / REAL HYDRADB SAMPLE" badge. |
| `stills/04_mcp_firewall_block.png` | /mcp gateway, protected-write `quarantine_memory` blocked: `{"ok":false,"error":"unauthorized"}`; scan_context -> ALLOW in the call log. |
| `stills/05_memory_certificate.png` | Verified Memory Integrity Certificate: MIC-2026-REFUND-001, risk 87, BLOCKED, tainted node, regression rule, seal. (Poster source.) |
| `stills/06_console_incidents.png` | Demo tenant's real incident dashboard: 11 incidents, 11 BLOCKED, criticals-over-time chart, full history with real UTC timestamps. |
| `stills/07_console_keys_connect_agent.png` | /console/keys - honestly documents the Supabase magic-link auth wall (signed out). Page chrome reads "API Keys". |
| `stills/08_console_rules.png` | /console/rules - same auth wall, page chrome reads "Detection Rules". |

### Script + copy

- `DEMO_SCRIPT.md` - the shot-ready package: 90-second and 60-second beat tables
  (exact URLs + clicks), recording checklist, pre-warm/fallback notes, the
  YouTube/Discord description, and three candidate titles.

---

## What is rendered vs real-screen-captured (honest)

- `constellan_screencap.mp4` and all nine `stills/*.png`: **real**, captured from
  the live deployed frontend/backend. The attack runs were triggered by actually
  clicking "Run live attack"; the live Groq result lands at ~90/CRITICAL as
  documented, and the deterministic floor is 87/HIGH.
- `constellan_film.mp4`: **rendered** with Remotion (motion design). It dramatises
  the real story; it is not a screen recording. Treat it as the cinematic cut.
- Stills `07` and `08`: honest **limitation**. `/console/keys` and `/console/rules`
  hard-gate behind Supabase magic-link auth (no public bypass). Signed out, both
  correctly show the real sign-in gate. The post-login ConnectAgentPanel
  (`pip install hydrasentry-mcp` + `hs_live_` key) and the rule table only render
  after a magic-link round-trip, which a headless capture cannot complete. The
  page chrome still reads "API Keys" / "Detection Rules", so the route is correct.

---

## How to record your own take

The exact steps live in `DEMO_SCRIPT.md`. The short version:

**Setup**
- Chrome at 1920x1080, OS scaling 100%, browser zoom 100%, bookmarks bar hidden
  (Ctrl+Shift+B), extra tabs/extensions closed, system notifications muted.
- Record at 1080p60 if possible; the stage animations read better at 60fps.

**Buttons to click, in order**
1. **Run Judge Demo / Run live attack** (landing hero CTA) - this persists a run.
   Do not deep-link `/results` after only the idle hero animation; it will not
   persist a run.
2. Open the certificate: click the certificate / report control on the result.
3. **Run live HydraDB query** on `/graph` (optional proof beat).
4. Magic-link sign-in on `/console` (open the email in a second window first so
   the click is instant on camera).
5. **Create key** on `/console/keys`, then read the copy-once `hs_live_` modal.
6. Hold on the **1 · INSTALL THE MCP SERVER** block (`pip install hydrasentry-mcp`).

**Pre-warm and fallbacks**
- Pre-warm the owned HydraDB tenant ~90s before recording so the `/graph` badge
  reads REAL HydraDB query_paths. If cold, it reads DERIVED SCENARIO GRAPH
  FALLBACK and that is fine; the label is the honesty pitch.
- If anything is off, `POST https://backend-three-puce-75.vercel.app/runs/judge-demo`
  returns the same canonical artifact (87 / HIGH / memory_poisoning / 0.92),
  deterministic and sub-200ms. Never gamble the demo on a live network call.

**Honesty rules on camera**
- Say "REAL HydraDB query paths" or "DERIVED scenario fallback" out loud, matching
  the on-screen badge. Never present derived data as real.
- The real path (`POST /runs/real`) is a real Groq llama-4-scout agent (two
  parallel agents, clean and poisoned), scored by a real Groq judge (~CRITICAL/90).
  The deterministic 87 / HIGH is the labelled fail-closed floor.
- No Claude or Anthropic references anywhere in narration or captions.

---

## Description and titles

The submission description and three candidate titles are in `DEMO_SCRIPT.md`
under "YouTube / Discord description" and "Candidate titles". Lead title:

> HydraSentry: catching the AI memory-poisoning attack your prompt scanner cannot see
