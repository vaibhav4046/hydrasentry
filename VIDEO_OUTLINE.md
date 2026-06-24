# HydraSentry Video Outline

The launch film is a Remotion project in `remotion/`. It mirrors the storyboard in `docs/assets/hydrasentry_ui_assets/remotion/storyboard.md`. Style throughout: monochrome noir, white and black only, no orange, no cartoon motion — a classified graph security terminal.

Composition: `HydraSentryDemoFilm`, 1920×1080. The storyboard runs to 75 seconds.

## Nine-scene outline

| # | Time | Scene |
|---|------|-------|
| 1 | 0–8s | Black grid. A white graph tree grows out of the dark. The HydraSentry wordmark resolves. |
| 2 | 8–16s | A clean memory graph. Risk reads 12/100. The baseline agent correctly asks for manager approval. |
| 3 | 16–26s | A poisoned memory node enters the graph. Its path pulses white-hot. |
| 4 | 26–36s | The poisoned output approves the refund. The risk counter climbs to 87/100. |
| 5 | 36–48s | The `query_paths` triplets appear one by one as `source → relation → target`. |
| 6 | 48–58s | The MCP firewall intercepts the tainted path: context blocked, poisoned memory quarantined. |
| 7 | 58–66s | The SkillMake verifier flags the unsafe `SKILL.md` lines (hidden injection, secret access, exfil). |
| 8 | 66–75s | The finding report is generated. Final CTA: *"Run the attack before your users do."* |
| 9 | Close | Wordmark + tagline hold on black. (Closing beat that ends the 75s film.) |

> Note: the storyboard text lists eight numbered beats across 75 seconds; scene 9 here is the closing hold that lands the final frame. Keep the on-screen numbers (risk 12 → 87) consistent with the deterministic engine.

## Render commands

From the `remotion/` directory:

```bash
cd remotion
npm install          # first time only
npm start            # opens Remotion Studio (alias for: remotion studio)
npm run render       # renders to out/hydrasentry-demo.mp4
npm run render4k     # renders at 2x scale to out/hydrasentry-demo-4k.mp4
```

Other available scripts (from `remotion/package.json`): `npm run bundle`, `npm run still` (single frame at frame 300), `npm run typecheck`.
