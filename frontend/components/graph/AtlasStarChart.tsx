"use client";

import { useEffect, useRef } from "react";
import {
  type AtlasGraphModel,
  type AtlasGraphStar,
  buildAtlasField,
} from "@/lib/cockpit/atlasGraphModel";
import {
  SILVER,
  radiusFor,
  computePlot,
  drawFrame,
  drawSweep,
  drawGlyph,
  drawArrowhead,
  type Plot,
} from "./atlasDraw";

/**
 * The working Context Graph star-atlas canvas, a larger, interactive
 * observation plate of THIS run's memory, in the same cartographic language as
 * the homepage StarChart (azimuth ring, RA/Dec ticks, sparse twinkle field, a
 * slow sentinel sweep), but rendering the rich, logical context graph:
 *
 *   - thin constellation lines carry directed logical relations; the tainted
 *     path burns bright with an animated directed flow, the severed limb into
 *     the guardian is a dashed dark line that stops short of the firewall star,
 *     clean lines stay faint silver.
 *   - stars are the context entities, drawn at magnitude with a kind glyph; the
 *     poisoned memory / unsafe action are EXTINCTION stars (dark crossed disc),
 *     the firewall is the GUARDIAN star inside a bright shield ring.
 *   - hover brightens a star + its incident lines + label; click selects it.
 *
 * Implementation: DPR-scaled canvas for crisp hairlines at retina/4K; geometry
 * is 100% deterministic (atlasGraphModel) so SSR/CSR match, only opacities and
 * two slow angles animate, all on the 2D context at 60fps. rAF pauses off-screen
 * / when hidden, and under prefers-reduced-motion one static frame is drawn.
 * Monochrome only; danger = brightness + the dark extinction star + the dashed
 * severed limb, never hue.
 */

interface AtlasStarChartProps {
  model: AtlasGraphModel;
  selectedId: string;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  /**
   * Cinematic build progress [0..1]. 1 = fully materialized (the normal, frozen
   * behaviour and the default). While a live HydraDB query is in flight the page
   * ramps this 0 → 1 so the constellation draws itself in: stars fade/scale in
   * in catalogue order, their incident lines draw after them, and a bright
   * scanning bar sweeps the plate. Purely a loading affordance over the existing
   * deterministic layout — no new data, no LIVE claim. Under reduced motion the
   * page holds this at 1 so the final state shows instantly (never blank).
   */
  reveal?: number;
}

const FIELD = buildAtlasField(130);

export function AtlasStarChart({
  model,
  selectedId,
  hoverId,
  onHover,
  onSelect,
  reveal = 1,
}: AtlasStarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep the latest interaction state in a ref so the rAF closure reads fresh
  // values without re-subscribing the whole effect every render. Synced in an
  // effect (never during render) per the rules of refs. `reveal` lives here too
  // so the rAF/paused redraw reads the freshest build progress every frame
  // without re-running the heavy setup effect.
  const stateRef = useRef({ model, selectedId, hoverId, reveal });
  // Screen-space star hitboxes, recomputed each frame for pointer mapping.
  const hitsRef = useRef<Array<{ id: string; x: number; y: number; r: number }>>([]);
  // When paused (reduced motion / off-screen), a ref-bumped redraw is requested
  // so hover/selection still repaints. The setup effect installs the redrawer.
  const redrawRef = useRef<(() => void) | null>(null);

  // Sync the live state into the ref and nudge a redraw if the loop is paused.
  useEffect(() => {
    stateRef.current = { model, selectedId, hoverId, reveal };
    redrawRef.current?.();
  }, [model, selectedId, hoverId, reveal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    let running = true;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const startT = performance.now();

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const t = (now - startT) / 1000;
      const { model, selectedId, hoverId, reveal } = stateRef.current;
      const p = computePlot(w, h);
      const px = (nx: number) => p.ox + nx * p.size;
      const py = (ny: number) => p.oy + ny * p.size;

      // Cinematic build: stars materialize in catalogue order across the first
      // ~75% of the reveal, each with a short local fade/scale; their lines draw
      // once both endpoints are present. reveal===1 short-circuits to the normal
      // fully-composed picture (the frozen default, and the reduced-motion path).
      const building = reveal < 1;
      const starCount = Math.max(1, model.stars.length);
      // Local materialization progress for a star at catalogue index i.
      const starReveal = (i: number): number => {
        if (!building) return 1;
        const start = (i / starCount) * 0.72; // last star starts at ~0.72
        const span = 0.28; // each star fades in over ~0.28 of the timeline
        return clamp01((reveal - start) / span);
      };
      const starRevealById = new Map<string, number>();
      model.stars.forEach((s, i) => starRevealById.set(s.id, starReveal(i)));

      ctx!.clearRect(0, 0, w, h);
      drawFrame(ctx!, p);

      // ---- faint background field --------------------------------------
      for (let i = 0; i < FIELD.length; i++) {
        const s = FIELD[i];
        const dx = s.x - 0.5;
        const dy = s.y - 0.5;
        if (Math.hypot(dx, dy) > 0.495) continue;
        const tw = reduce
          ? 0.5
          : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + s.ph * Math.PI * 2));
        const base = Math.max(0, 0.5 - (s.mag - 2.8) / 5);
        ctx!.fillStyle = `rgba(${SILVER},${(0.1 + base * 0.42) * tw})`;
        ctx!.beginPath();
        ctx!.arc(px(s.x), py(s.y), radiusFor(s.mag, p.scale), 0, Math.PI * 2);
        ctx!.fill();
      }

      const starById = new Map<string, AtlasGraphStar>(
        model.stars.map((s) => [s.id, s]),
      );

      // A star is "active" when hovered or selected, it and its lines/label
      // brighten. We also brighten lines incident to the active star.
      const activeId = hoverId ?? selectedId;

      // ---- constellation lines -----------------------------------------
      for (const e of model.lines) {
        const a = starById.get(e.from);
        const b = starById.get(e.to);
        if (!a || !b) continue;
        // During the build, a line only draws once BOTH endpoint stars have
        // materialized; it then draws on progressively. Outside the build this
        // is always 1 (no behaviour change).
        const lineReveal = building
          ? Math.min(
              starRevealById.get(e.from) ?? 1,
              starRevealById.get(e.to) ?? 1,
            )
          : 1;
        if (lineReveal <= 0.02) continue;
        const x1 = px(a.x);
        const y1 = py(a.y);
        const x2 = px(b.x);
        const y2 = py(b.y);
        const incident = activeId === e.from || activeId === e.to;
        drawLine(ctx!, x1, y1, x2, y2, e, p, t, reduce, incident, lineReveal);
      }

      // ---- stars -------------------------------------------------------
      const hits: Array<{ id: string; x: number; y: number; r: number }> = [];
      for (const s of model.stars) {
        const x = px(s.x);
        const y = py(s.y);
        const r = radiusFor(s.mag, p.scale);
        const active = activeId === s.id;
        const selected = selectedId === s.id;
        const sr = starRevealById.get(s.id) ?? 1;
        if (sr <= 0.001) continue;
        drawStar(ctx!, s, x, y, r, p, t, reduce, active, selected, sr);
        // Hitbox: a generous disc around the glyph for easy clicking. Only once
        // the star is substantially materialized so the build can't be clicked
        // through to a half-drawn node.
        if (sr > 0.6) {
          hits.push({ id: s.id, x, y, r: Math.max(r * 3.2, 12 * p.scale + 8) });
        }
      }
      hitsRef.current = hits;

      // Scanning shimmer: a bright vertical bar sweeping the plate left→right
      // tracks the build front, reading as a live traversal materializing the
      // graph. Only during the build, and never under reduced motion.
      if (building && !reduce) drawScanBar(ctx!, p, reveal);

      if (!reduce) drawSweep(ctx!, p, t);

      if (running && !reduce) raf = requestAnimationFrame(draw);
    }

    resize();
    draw(performance.now());

    // Allow the state-sync effect to repaint when the animation loop is paused
    // (reduced motion or scrolled off-screen) so hover/selection still shows.
    redrawRef.current = () => {
      if (!running || reduce) draw(performance.now());
    };

    let io: IntersectionObserver | null = null;
    const setRunning = (next: boolean) => {
      if (next === running) return;
      running = next;
      if (running && !reduce) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    };

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => setRunning(entries.some((e) => e.isIntersecting)),
        { rootMargin: "120px 0px" },
      );
      io.observe(canvas);
    }

    const onVis = () => setRunning(!document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const onResize = () => {
      resize();
      draw(performance.now());
    };
    window.addEventListener("resize", onResize, { passive: true });

    // ---- pointer interaction (hit-test against the per-frame star discs) ---
    function hitAt(clientX: number, clientY: number): string | null {
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      let best: { id: string; d: number } | null = null;
      for (const hb of hitsRef.current) {
        const d = Math.hypot(mx - hb.x, my - hb.y);
        if (d <= hb.r && (!best || d < best.d)) best = { id: hb.id, d };
      }
      return best?.id ?? null;
    }

    const onMove = (ev: PointerEvent) => {
      const id = hitAt(ev.clientX, ev.clientY);
      canvas.style.cursor = id ? "pointer" : "default";
      onHover(id);
      // If motion is paused (reduced/off-screen) redraw once so hover shows.
      if (reduce || !running) draw(performance.now());
    };
    const onLeave = () => {
      onHover(null);
      if (reduce || !running) draw(performance.now());
    };
    const onClick = (ev: PointerEvent) => {
      const id = hitAt(ev.clientX, ev.clientY);
      if (id) onSelect(id);
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onClick);

    return () => {
      cancelAnimationFrame(raf);
      redrawRef.current = null;
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onClick);
    };
    // onHover/onSelect are stable (useCallback in the parent); model/selection
    // are read live via stateRef so they must not re-run this setup effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Context graph constellation: the memory poisoning attack flow charted as stars, with the tainted path severed at the MCP firewall guardian star"
      style={{ display: "block", width: "100%", height: "100%", touchAction: "manipulation" }}
    />
  );
}

// ---------------------------------------------------------------------------
// Per-element draw helpers (kept here as they need the model line/star types).
// ---------------------------------------------------------------------------

interface LineLike {
  from: string;
  to: string;
  tainted?: boolean;
  severed?: boolean;
}

function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  e: LineLike,
  p: Plot,
  t: number,
  reduce: boolean,
  incident: boolean,
  reveal = 1,
): void {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  // Pull endpoints in a little so lines start/stop just outside the glyphs.
  const inset = 11 * p.scale + 7;
  const sx = x1 + Math.cos(ang) * inset;
  const sy = y1 + Math.sin(ang) * inset;
  const ex = x2 - Math.cos(ang) * inset;
  const ey = y2 - Math.sin(ang) * inset;

  ctx.save();
  // Cinematic build: a freshly-connected line fades in. reveal===1 is the
  // normal, fully-opaque path (globalAlpha stays 1) so nothing changes once the
  // build settles. The save above guarantees this is restored on every path.
  if (reveal < 1) ctx.globalAlpha = easeOutCubic(clamp01(reveal));

  if (e.severed) {
    // The severed limb: a dashed dark line that visibly STOPS short of the
    // guardian, with a small break gap + a faint "cut" tick at the end.
    const cut = ex - Math.cos(ang) * (16 * p.scale + 8);
    const cy2 = ey - Math.sin(ang) * (16 * p.scale + 8);
    ctx.setLineDash([5 * p.scale, 5 * p.scale]);
    ctx.lineDashOffset = reduce ? 0 : -t * 16;
    ctx.strokeStyle = `rgba(${SILVER},${incident ? 0.5 : 0.34})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cut, cy2);
    ctx.stroke();
    ctx.setLineDash([]);
    // the cut mark, a short cross perpendicular to the limb, the sever point
    const perp = ang + Math.PI / 2;
    const m = 4.5 * p.scale + 2;
    ctx.strokeStyle = `rgba(${SILVER},${incident ? 0.85 : 0.6})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(cut + Math.cos(perp) * m, cy2 + Math.sin(perp) * m);
    ctx.lineTo(cut - Math.cos(perp) * m, cy2 - Math.sin(perp) * m);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (e.tainted) {
    // Bright tainted relation + animated directed flow (dash marching from
    // source → target) + an arrowhead near the target.
    ctx.strokeStyle = `rgba(255,255,255,${incident ? 0.95 : 0.8})`;
    ctx.lineWidth = incident ? 2.1 : 1.7;
    ctx.shadowColor = "rgba(255,255,255,0.6)";
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (!reduce) {
      // marching dashes for the directed flow
      const dash = 5 * p.scale;
      const gap = 22 * p.scale;
      ctx.setLineDash([dash, gap]);
      ctx.lineDashOffset = -((t * (40 * p.scale)) % (dash + gap));
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineCap = "butt";
    }
    drawArrowhead(ctx, ex, ey, ang, 7 * p.scale + 3, "#ffffff");
    ctx.restore();
    return;
  }

  // Clean relation, faint silver with a small arrowhead.
  ctx.strokeStyle = `rgba(${SILVER},${incident ? 0.5 : 0.26})`;
  ctx.lineWidth = incident ? 1.4 : 1.1;
  if (len > 0) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  drawArrowhead(
    ctx,
    ex,
    ey,
    ang,
    5.5 * p.scale + 2,
    `rgba(${SILVER},${incident ? 0.6 : 0.32})`,
  );
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  s: AtlasGraphStar,
  x: number,
  y: number,
  r: number,
  p: Plot,
  t: number,
  reduce: boolean,
  active: boolean,
  selected: boolean,
  reveal = 1,
): void {
  // Cinematic build: a materializing star scales up from a point and fades in.
  // reveal===1 is the normal path (no transform), so the frozen picture is
  // byte-identical once the build completes. The body has several early returns,
  // so wrap the whole paint in one save/restore that always balances.
  const building = reveal < 1;
  if (building) {
    ctx.save();
    const e = easeOutCubic(reveal);
    ctx.globalAlpha = e;
    ctx.translate(x, y);
    ctx.scale(0.55 + 0.45 * e, 0.55 + 0.45 * e);
    ctx.translate(-x, -y);
  }
  try {
    paintStar();
  } finally {
    if (building) ctx.restore();
  }

  function paintStar(): void {
  // Selection / hover reticle around any focused star.
  if (active || selected) {
    ctx.strokeStyle = active
      ? `rgba(${SILVER},0.85)`
      : `rgba(${SILVER},0.5)`;
    ctx.lineWidth = 1;
    const rr = Math.max(r * 3, 14 * p.scale + 6);
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.stroke();
    // small corner ticks on the reticle
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      ctx.lineTo(x + Math.cos(a) * (rr + 4), y + Math.sin(a) * (rr + 4));
      ctx.stroke();
    }
  }

  if (s.extinct) {
    // Collapsed star: a dark void disc punched out of the field, a broken
    // collapse ring, and an extinction cross, the memory going dark.
    const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3 + s.x * 5);
    const rr = r * 1.9 * (1.08 - pulse * 0.22);
    ctx.fillStyle = "rgba(2,3,4,0.96)";
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    const a = active ? 0.85 : 0.35 + pulse * 0.3;
    ctx.strokeStyle = `rgba(${SILVER},${a})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0.4, Math.PI * 1.35);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, rr, Math.PI * 1.6, Math.PI * 2.2);
    ctx.stroke();
    const c = rr * 0.62;
    ctx.strokeStyle = `rgba(${SILVER},${active ? 0.95 : 0.55})`;
    ctx.beginPath();
    ctx.moveTo(x - c, y - c);
    ctx.lineTo(x + c, y + c);
    ctx.moveTo(x + c, y - c);
    ctx.lineTo(x - c, y + c);
    ctx.stroke();
    return;
  }

  const tw = reduce ? 1 : 0.84 + 0.16 * Math.sin(t * 0.9 + s.x * 6);

  if (s.guardian) {
    // Guardian star: bright core + a shield ring + soft halo. Reads as the
    // protector that severs the tainted limb.
    const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    halo.addColorStop(0, `rgba(${SILVER},${0.3 * tw})`);
    halo.addColorStop(1, `rgba(${SILVER},0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, r * 7, 0, Math.PI * 2);
    ctx.fill();
    // bright shield ring
    ctx.strokeStyle = `rgba(255,255,255,${active ? 0.95 : 0.8})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.5, 0, Math.PI * 2);
    ctx.stroke();
    // core
    ctx.fillStyle = `rgba(255,255,255,${0.95 * tw})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    drawGlyph(ctx, s.kind, x, y, r, active ? 0.95 : 0.7);
    return;
  }

  // Ordinary star: optional soft halo for the brighter ones, a crisp core,
  // then the kind glyph above it.
  const bright = s.mag < 1.8;
  const stale = s.kind === "policy_stale";
  if (bright) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
    g.addColorStop(0, `rgba(${SILVER},${(active ? 0.3 : 0.2) * tw})`);
    g.addColorStop(1, `rgba(${SILVER},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  const coreAlpha = stale ? 0.4 : s.tainted ? 0.92 : 0.85;
  ctx.fillStyle = `rgba(255,255,255,${coreAlpha * tw})`;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // diffraction ticks on the origin (the chart's anchor)
  if (s.kind === "origin") {
    ctx.strokeStyle = `rgba(${SILVER},${0.45 * tw})`;
    ctx.lineWidth = 1;
    const d = r * 3.2;
    ctx.beginPath();
    ctx.moveTo(x - d, y);
    ctx.lineTo(x + d, y);
    ctx.moveTo(x, y - d);
    ctx.lineTo(x, y + d);
    ctx.stroke();
  }

  drawGlyph(
    ctx,
    s.kind,
    x,
    y,
    r,
    stale ? 0.35 : active ? 0.9 : s.tainted ? 0.75 : 0.6,
  );
  }
}

/** Smooth ease for the materialize-in scale/fade. */
function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * The scanning shimmer bar that tracks the cinematic build front: a bright,
 * soft-edged vertical band sweeping left→right across the plot as the graph
 * materializes, with a thin leading edge. Compositor-cheap (one gradient fill).
 * Drawn only during the build; reveal in [0..1] places the bar.
 */
function drawScanBar(ctx: CanvasRenderingContext2D, p: Plot, reveal: number): void {
  const e = clamp01(reveal);
  // Lead the build front slightly so the bar sits just ahead of the newest star.
  const cx = p.ox + (0.04 + e * 0.96) * p.size;
  const bandW = Math.max(26, p.size * 0.13);
  const x0 = cx - bandW;
  ctx.save();
  // Clip to the plot square so the bar never bleeds over the frame chrome.
  ctx.beginPath();
  ctx.rect(p.ox, p.oy, p.size, p.size);
  ctx.clip();
  const grad = ctx.createLinearGradient(x0, 0, cx, 0);
  grad.addColorStop(0, "rgba(234,240,250,0)");
  grad.addColorStop(0.7, "rgba(234,240,250,0.05)");
  grad.addColorStop(1, "rgba(234,240,250,0.14)");
  ctx.fillStyle = grad;
  ctx.fillRect(x0, p.oy, bandW, p.size);
  // Thin bright leading edge, fades out as the build completes.
  ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - e * 0.5)})`;
  ctx.lineWidth = 1.2;
  ctx.shadowColor = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.moveTo(cx, p.oy);
  ctx.lineTo(cx, p.oy + p.size);
  ctx.stroke();
  ctx.restore();
}
