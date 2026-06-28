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

**`constellan_master.mp4` is the primary video.** It is the assembled master cut:
a short Remotion title intro, then the RE-CAPTURED real-UI screen capture of the
NEW linear no-login flow as the core, then the Remotion closing wordmark, with the
narration burned in as captions over the screen-capture section. 51.1s, 1920x1080,
h264, 30fps, faststart. Every frame of the core is the actual deployed product; the
intro and outro are clearly the rendered title/wordmark, so the honesty rule holds.
This is the cut to submit.

Segment breakdown: Remotion intro (film 2.0s to 13.0s, the HydraSentry title card
"Agents do not fail at the prompt. They fail at memory.") -> RE-CAPTURED real screen
capture (34.5s, six burned-in caption cues) -> Remotion outro (film 64.5s to 70.0s,
the signed certificate resolving to REPLAY / TRACE / BLOCK / CERTIFY).

**`constellan_screencap.mp4` is the raw real-UI capture (core source).** Headless
Chrome (CDP screencast) driving the live Vercel frontend and backend (backend
verified healthy, mode=demo) through the NEW linear flow: the hero with "Run live
attack" above the fold, the button really clicked, the live Groq result (90/CRITICAL)
plus the "Open full dashboard" CTA rendering inline IN VIEW (no scroll-hunt), then
`/console` (no login wall, real demo-tenant incidents), `/console/keys`
(connect-your-agent steps public), and `/standards` (OWASP ASI Top-10 self-verifying
map). Every frame is the actual deployed product, not an animation; zero console
errors during capture. Used as the middle of the master cut.

**`constellan_film.mp4` is the polished Remotion companion (intro/outro source).**
A Remotion render (noir/monochrome motion design) of the same story across eight
scenes, ending on the signed Memory Integrity Certificate and the REPLAY / TRACE /
BLOCK / CERTIFY wordmark. The master cut draws its intro and outro from this film.
It is rendered art, not a live capture, and is labelled as such.

All three tell the same true story (refund agent on HydraDB memory, poisoned
policy, 87 / HIGH deterministic vs ~90 / CRITICAL live Groq, query_paths taint
chain, MCP firewall block, signed certificate). Submit `constellan_master.mp4`;
the screen capture and the film remain available as the raw core and the cinematic
cut.

---

## Asset index

### Video (verified with ffprobe)

| File | Kind | Duration | Resolution | Codec / fps | Size | Notes |
|------|------|----------|------------|-------------|------|-------|
| `constellan_master.mp4` | Assembled master cut (PRIMARY) | 51.07s | 1920x1080 | h264 / 30fps | ~4.3 MB | Remotion intro + RE-CAPTURED real screen capture of the NEW linear no-login flow (burned-in captions) + Remotion outro wordmark. yuv420p, faststart, AAC stereo. The cut to submit. |
| `constellan_screencap.mp4` | Real-UI screen capture (core source) | 34.53s | 1920x1080 | h264 / 30fps | ~2.7 MB | RE-CAPTURED NEW linear flow: hero -> "Run live attack" clicked -> inline LIVE RUN RESULT (90/CRITICAL) + "Open full dashboard" CTA in view -> /console no-wall demo-tenant incidents -> /console/keys connect-your-agent -> /standards OWASP ASI map. Zero console errors. |
| `constellan_film.mp4` | Remotion render (intro/outro source) | 70.06s | 1920x1080 | h264 / 30fps | ~10.8 MB | 8-scene noir motion film of the same story; ends on signed certificate + moat strip + REPLAY · TRACE · BLOCK · CERTIFY wordmark. |

All three MP4s verified with ffprobe: duration > 0, one h264 video stream,
1920x1080. The master cut is 30fps, SAR 1:1, yuv420p, faststart, with one AAC
stereo audio track (silent over the screen-capture section). All play.

### Captions

- `captions.srt` - the master burned-caption track, 6 cues timed over the new
  screencap (master-relative ~0:11 to ~0:45). No em dashes, no Claude/Anthropic
  references.

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
| `stills/06_console_incidents.png` | /console with NO login wall: the demo tenant's real incident dashboard (signed out), honest banner "Showing the demo tenant's real persisted incidents (read-only). Sign in to see and manage your own", criticals-over-time chart, real UTC timestamps, grouped sidebar IA. |
| `stills/07_console_keys_connect_agent.png` | /console/keys with NO login wall: the connect-your-agent steps (`pip install hydrasentry-mcp` + MCP client config) are fully public, a labelled key PREVIEW row, and ONLY the mint action gated ("Sign in to mint"). |
| `stills/08_console_rules.png` | /console/rules with NO login wall: the demo tenant's 3 real read-only detection rules (static ENABLED pills, no toggle/delete when signed out), honest read-only provenance banner. |

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
- `/console`, `/console/keys`, and `/console/rules`: **NO login wall** anymore.
  Signed out, all three show the real demo tenant's content read-only with honest
  labels ("Showing the demo tenant's real... Sign in to see your own"). The
  connect-your-agent steps on `/console/keys` are fully public; only the mint
  action is gated behind a quick sign-in. The only thing a headless capture still
  cannot show is the AUTHED tenant (post magic-link sign-in), which by design needs
  a human inbox click; that is the one honest human-only gap, not a product wall.

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
