# HydraSentry Design System

A monochrome noir system. The product should read like a **classified graph security terminal**, not a generic SaaS dashboard. The source brief is `docs/assets/hydrasentry_ui_assets/DESIGN_BRIEF.md`; tokens live in `frontend/app/globals.css` and the asset-pack `tokens/tokens.css`; motion in `frontend/lib/motion.ts`.

## The black-and-white law

**Black and white only. No orange. No colorful gradients.** State, risk, and emphasis are expressed through grayscale intensity, glow, outlines, opacity, and motion — never through hue. There is deliberately no blue/green/red/violet accent. Even risk severity uses white intensity, labels, icons, and border patterns, not a saturated colour ramp. This is the single hardest rule and it is what makes the product look intentional.

## Color tokens

From `tokens.css` (`--hs-*`):

| Token | Value | Use |
|-------|-------|-----|
| `--hs-bg-base` | `#050608` | app background |
| `--hs-bg-deep` | `#020305` | deepest panel / void |
| `--hs-bg-panel` | `#0B0D10` | panel surface |
| `--hs-bg-elevated` | `#11141A` | elevated surface |
| `--hs-glass` | `rgba(255,255,255,0.055)` | glass fill |
| `--hs-glass-strong` | `rgba(255,255,255,0.085)` | stronger glass fill |
| `--hs-border` | `rgba(255,255,255,0.10)` | default 1px border |
| `--hs-border-strong` | `rgba(255,255,255,0.18)` | emphasised border |
| `--hs-text-primary` | `#F5F7FA` | primary text |
| `--hs-text-secondary` | `#9CA3AF` | secondary text |
| `--hs-text-muted` | `#5F6875` | muted/captions |
| `--hs-white` / `--hs-black` | `#FFFFFF` / `#000000` | pure poles |
| `--hs-danger` | `#F5F7FA` | "danger" — note: near-white, not red |
| `--hs-safe` | `#D7DCE5` | "safe" — light gray |
| `--hs-warning` | `#B7BEC9` | "warning" — mid gray |
| `--hs-shadow-soft` | `0 24px 90px rgba(0,0,0,0.55)` | panel shadow |
| `--hs-glow-white` | `0 0 32px rgba(255,255,255,0.22)` | white glow |

The crucial detail: `--hs-danger`, `--hs-safe`, and `--hs-warning` are all points on the white→gray axis. Risk is communicated by *intensity and treatment*, not colour.

## Buttons

The single button primitive is `GlowButton` (`frontend/components/noir/GlowButton.tsx`), backed by `.hydra-button-*` classes. Variants: `primary | secondary | ghost | danger`. Sizes: `sm | md | lg`.

- **Primary** (`.hydra-button-primary`): polished white→silver glass on black (`linear-gradient(180deg, #FFFFFF, #C9CED8)`), black text, 1px white border, soft white glow. Hover increases brightness, not colour.
- **Secondary** (`.hydra-button-secondary`): transparent black glass, white text, thin white border, subtle hover fill.
- **Ghost** (`.hydra-button-ghost`): faint glass fill, low-emphasis border.
- **Danger** (`.hydra-button-danger`): dark glass with a bright white outline and a `ShieldAlert` glyph — **never** a saturated red. The glyph is auto-added when no `iconLeft` is supplied.

All variants share rounded-xl geometry, a white focus-visible ring, and disabled opacity.

## Typography

A display + mono pairing: an expressive display face for headlines and a monospace face for the terminal/forensic surfaces (logs, `query_paths` triplets, chunk ids, scores). The monospace treatment reinforces the "security terminal" mood and is used wherever machine evidence is shown. Scale contrast is large — hero headlines against small mono captions — to carry hierarchy without colour.

## Motion

House style (`frontend/lib/motion.ts`): slow and cinematic, never bouncy. Durations 0.45–0.8s, easing `EASE_OUT_EXPO = [0.22, 1, 0.36, 1]`. Reveal motion leans on opacity + small `y` + blur so content reads as "surfacing from the dark" rather than sliding. Respects reduced-motion via `MotionProvider`.

| Variant | Purpose |
|---------|---------|
| `fadeUp` | default scroll reveal (opacity + y + blur) |
| `fadeIn` | plain opacity reveal |
| `staggerContainer` | parent that staggers children (0.08s) |
| `scaleIn` | subtle scale-up reveal |
| `blurReveal` | strong blur→sharp reveal (0.8s) |
| `panelHover` | interactive panel hover (scale 1.012 + border brighten) |
| `glowPulse` | breathing glow for live/active indicators |
| `graphEdgeReveal` | SVG stroke-dash reveal for graph edges (`pathLength`) |
| `riskCountUp` | shared transition for animated risk numerics |
| `terminalLineReveal` | per-line terminal reveal |

(The asset-pack `tokens/framer-motion-variants.ts` carries a smaller subset — `fadeUp`, `stagger`, `panelHover`, `softReveal`; `lib/motion.ts` is the implemented superset used by the app.)

## Component inventory — the 17 noir components

Exported from `frontend/components/noir/index.ts`:

1. `NoirBackground` — the layered dark backdrop (grid, spotlight, noise).
2. `MotionProvider` — wraps the app; honours reduced-motion.
3. `GlassPanel` — the core glass surface (`.hydra-glass`).
4. `GlowButton` — the single button primitive (variants/sizes above).
5. `StatusPill` — small status chip; tone via `StatusTone`.
6. `SectionHeader` — section title + eyebrow.
7. `MetricCard` — single metric surface.
8. `TerminalLog` — monospace terminal/log surface with per-line reveal.
9. `RiskGauge` — the risk score gauge (count-up, banded by intensity).
10. `ContextGraphPreview` — compact graph preview for landing/cards.
11. `ProductCanvas` — the framed product surface.
12. `DemoTimeline` — the pipeline/stage timeline.
13. `AgentCrew` — the scheduled-agents crew display (`AgentDef`).
14. `ProviderCard` — model-provider tile with test state (`ProviderTestState`).
15. `ReportDrawer` — slide-in Markdown report drawer.
16. `NodeInspector` — inspector panel for a selected graph node.
17. `MonochromeLogo` — the wordmark/mark lockup.

Beyond the noir library, the graph surface uses `@xyflow/react` with custom `HydraNode` / `HydraEdge` and a `GraphSourceBadge` (REAL vs DERIVED), plus shell components (`AppNav`, `TopBar`, `PageShell`) and shared controls (`ScenarioPicker`, `SegmentedControl`, `StageTimeline`, `StateNotice`).

## Surfaces and assets

The UI asset pack (`docs/assets/hydrasentry_ui_assets/`, mirrored into `frontend/public/`) provides the brand mark/wordmark/favicon, the 4K noir hero graph, grid/spotlight/memory-tree backgrounds, a noise pattern, and eight monochrome icons (firewall, graph, mcp, replay, report, schedule, settings, skill). Glass surfaces use `.hydra-glass` (layered white gradient, 22px blur, soft shadow, inset highlight).

## Checklist (per the brief)

- Black and white only — no orange, no saturated accent colour.
- Risk shown via intensity/label/icon/border, never hue.
- Primary = white glass on black; danger = dark glass + white outline + glyph.
- Motion is slow, cinematic, blur-led; reduced-motion respected.
- Monospace for all machine evidence (logs, triplets, ids, scores).
- The page should look like a classified graph security terminal.
