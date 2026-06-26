"use client";

import { useEffect, useRef } from "react";
import {
  CONSTELLATION,
  CONSTELLATION_LINES,
  buildFieldStars,
  igniteOrder,
  type AtlasStar,
} from "./atlasData";
import {
  FIRST_LIGHT_FINAL,
  firstLightPhases,
  starIgnition,
  clamp01,
  type FirstLightPhases,
} from "./firstLight";

/**
 * The Memory Observatory star chart — the homepage centerpiece. A precise,
 * cartographic canvas (the antithesis of a glowing neural-network blob): an
 * azimuth ring with RA/Dec ticks, a sparse field of faint stars that twinkle
 * subtly, the "Memoria" constellation drawn as a thin silver figure with named
 * stars of varying magnitude, the tainted memory collapsing into a dark
 * crossed-out node, and a single slow sweep line — the sentinel watching the
 * chart.
 *
 * On first paint it plays a cinematic "First Light" boot sequence (firstLight.ts
 * drives the timeline): the engraved frame draws in → the azimuth ring sweeps on
 * → ticks tick in → stars ignite one-by-one with a brief diffraction flash → the
 * constellation lines draw along their length → the tainted limb lights and the
 * extinction star collapses → the sentinel sweep begins its loop. After ~2.85s it
 * hands off seamlessly to the calm idle (slow drift twinkle + sweep).
 *
 * Implementation notes:
 *  - Canvas is DPR-scaled (cap 3) for razor-crisp hairlines at retina/4K/8K;
 *    redrawn on resize via ResizeObserver.
 *  - Geometry is 100% deterministic (atlasData); only opacities, the boot
 *    timeline, and two slow angles animate — all on the compositor-free 2D
 *    context, no per-frame React state.
 *  - rAF is paused when the chart scrolls off-screen or the tab is hidden, and
 *    under prefers-reduced-motion the final settled frame is drawn once (no loop).
 *  - Pure monochrome (cool silver / white on void); danger = the star going
 *    dark + a severed dashed limb, never hue.
 */

const SILVER = "234,240,250"; // --hs-accent-bright as rgb tuple
const STAR_BY_ID = new Map<string, AtlasStar>(
  CONSTELLATION.map((s) => [s.id, s]),
);
const FIELD = buildFieldStars(96);
const DPR_CAP = 3; // razor-sharp at 4K/8K; backing store caps at 3× device pixels

/** Glyph radius (px) for a star of the given magnitude at the chart's scale. */
function radiusFor(mag: number, scale: number): number {
  // Brightest (mag 0) ~ 4.6px, faintest field (mag ~5) ~ 0.7px.
  return Math.max(0.7, (4.6 - mag * 0.78) * scale);
}

export function StarChart() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
    const start = performance.now();

    function resize() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const t = (now - start) / 1000;
      // Boot phases (or the settled final frame under reduced-motion).
      const p: FirstLightPhases = reduce ? FIRST_LIGHT_FINAL : firstLightPhases(t);
      const booting = !reduce && p.done < 1;

      // Plot rectangle: a square chart inset, centred, with margin for ticks.
      const pad = Math.min(w, h) * 0.085;
      const size = Math.min(w, h) - pad * 2;
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;
      const scale = size / 460; // glyph scale relative to a 460px reference
      const cx = ox + size / 2;
      const cy = oy + size / 2;

      const px = (nx: number) => ox + nx * size;
      const py = (ny: number) => oy + ny * size;

      ctx!.clearRect(0, 0, w, h);

      // ---- azimuth ring + radial ticks (the instrument frame) -------------
      const ringR = size * 0.49;
      // Outer ring sweeps on during boot (arc grows from 12 o'clock).
      if (p.ring > 0) {
        ctx!.lineWidth = 1;
        ctx!.strokeStyle = `rgba(${SILVER},${0.16 * p.ring})`;
        ctx!.beginPath();
        ctx!.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p.ring);
        ctx!.stroke();
      }
      if (p.innerRing > 0) {
        ctx!.strokeStyle = `rgba(${SILVER},${0.1 * p.innerRing})`;
        ctx!.beginPath();
        ctx!.arc(cx, cy, ringR * 0.74, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // Major + minor azimuth ticks around the outer ring (tick in by angle).
      if (p.ticks > 0) {
        for (let i = 0; i < 72; i++) {
          const frac = i / 72;
          if (frac > p.ticks) continue; // ticks appear sweeping clockwise
          const a = frac * Math.PI * 2 - Math.PI / 2;
          const major = i % 6 === 0;
          const r1 = ringR;
          const r2 = ringR + (major ? size * 0.022 : size * 0.011);
          ctx!.strokeStyle = `rgba(${SILVER},${(major ? 0.32 : 0.14) * p.ticks})`;
          ctx!.lineWidth = major ? 1.1 : 0.8;
          ctx!.beginPath();
          ctx!.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx!.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx!.stroke();
        }
      }

      // Faint crosshair through the core (RA/Dec gridlines).
      if (p.innerRing > 0) {
        ctx!.strokeStyle = `rgba(${SILVER},${0.06 * p.innerRing})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(ox, py(CONSTELLATION[0].y));
        ctx!.lineTo(ox + size, py(CONSTELLATION[0].y));
        ctx!.moveTo(px(CONSTELLATION[0].x), oy);
        ctx!.lineTo(px(CONSTELLATION[0].x), oy + size);
        ctx!.stroke();
      }

      // ---- faint star field (depth of the void) ---------------------------
      if (p.field > 0) {
        for (let i = 0; i < FIELD.length; i++) {
          const s = FIELD[i];
          // Keep field stars inside the ring for a clean plate.
          const dx = s.x - 0.5;
          const dy = s.y - 0.5;
          if (Math.hypot(dx, dy) > 0.49) continue;
          const tw = reduce
            ? 0.5
            : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + s.ph * Math.PI * 2));
          const base = Math.max(0, 0.5 - (s.mag - 2.6) / 5.2);
          const r = radiusFor(s.mag, scale);
          ctx!.fillStyle = `rgba(${SILVER},${(0.12 + base * 0.5) * tw * p.field})`;
          ctx!.beginPath();
          ctx!.arc(px(s.x), py(s.y), r, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // ---- constellation lines (the figure) -------------------------------
      // During boot, lines draw along their length via stroke-dashoffset; the
      // tainted limb only begins once the collapse phase lights it.
      const taintFade = reduce
        ? 0.5
        : 0.32 + 0.18 * Math.sin(t * 1.6); // the severed limb flickers faintly
      for (const e of CONSTELLATION_LINES) {
        const a = STAR_BY_ID.get(e.from);
        const b = STAR_BY_ID.get(e.to);
        if (!a || !b) continue;
        const lineProg = e.tainted ? p.collapse : p.lines;
        if (lineProg <= 0) continue;
        const ax = px(a.x);
        const ay = py(a.y);
        const bx = px(b.x);
        const by = py(b.y);
        ctx!.save();
        if (e.tainted) {
          ctx!.setLineDash([4 * scale, 5 * scale]);
          ctx!.lineDashOffset = reduce ? 0 : -t * 18;
          ctx!.strokeStyle = `rgba(${SILVER},${(0.14 + taintFade * 0.12) * lineProg})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(ax, ay);
          ctx!.lineTo(bx, by);
          ctx!.stroke();
        } else {
          // draw fraction of the segment for the "draw-on" effect
          ctx!.strokeStyle = `rgba(${SILVER},0.3)`;
          ctx!.lineWidth = 1.1;
          ctx!.beginPath();
          ctx!.moveTo(ax, ay);
          ctx!.lineTo(ax + (bx - ax) * lineProg, ay + (by - ay) * lineProg);
          ctx!.stroke();
        }
        ctx!.restore();
      }

      // ---- named constellation stars --------------------------------------
      for (const s of CONSTELLATION) {
        const x = px(s.x);
        const y = py(s.y);
        const { reveal, flash } = booting
          ? starIgnition(p.ignite, igniteOrder(s.id))
          : { reveal: 1, flash: 0 };
        if (reveal <= 0) continue;

        if (s.tainted) {
          // Collapsed star: a dark void disc, a thin broken ring, and a faint
          // cross — the memory going dark. Its appearance is gated on collapse.
          const cv = p.collapse;
          if (cv <= 0) continue;
          const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3);
          const r = radiusFor(s.mag, scale) * (1.1 - pulse * 0.25);
          // dark core punched out of the field
          ctx!.fillStyle = `rgba(2,3,4,${0.95 * cv})`;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 1.7, 0, Math.PI * 2);
          ctx!.fill();
          // broken collapse ring
          ctx!.strokeStyle = `rgba(${SILVER},${(0.3 + pulse * 0.3) * cv})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 1.7, 0.4, Math.PI * 1.4);
          ctx!.stroke();
          ctx!.beginPath();
          ctx!.arc(x, y, r * 1.7, Math.PI * 1.6, Math.PI * 2.2);
          ctx!.stroke();
          // extinction cross
          const c = r * 1.1;
          ctx!.strokeStyle = `rgba(${SILVER},${0.5 * cv})`;
          ctx!.beginPath();
          ctx!.moveTo(x - c, y - c);
          ctx!.lineTo(x + c, y + c);
          ctx!.moveTo(x + c, y - c);
          ctx!.lineTo(x - c, y + c);
          ctx!.stroke();
          continue;
        }

        const r = radiusFor(s.mag, scale) * (0.7 + 0.3 * reveal);
        const tw = (reduce ? 1 : 0.82 + 0.18 * Math.sin(t * 0.9 + s.x * 6)) * reveal;

        // soft halo for the brightest few (boosted briefly by the ignition flash)
        if (s.mag < 2) {
          const haloR = r * (6 + flash * 5);
          const g = ctx!.createRadialGradient(x, y, 0, x, y, haloR);
          g.addColorStop(0, `rgba(${SILVER},${(0.22 + flash * 0.5) * tw})`);
          g.addColorStop(1, `rgba(${SILVER},0)`);
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, haloR, 0, Math.PI * 2);
          ctx!.fill();
        }

        // crisp white core
        ctx!.fillStyle = `rgba(255,255,255,${clamp01(0.85 * tw + flash * 0.4)})`;
        ctx!.beginPath();
        ctx!.arc(x, y, r, 0, Math.PI * 2);
        ctx!.fill();

        // diffraction-spike flash as a star ignites (brief 4-point spike)
        if (flash > 0.04 && s.mag < 2.6) {
          const d = r * (3 + flash * 9);
          ctx!.strokeStyle = `rgba(255,255,255,${flash * 0.7})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(x - d, y);
          ctx!.lineTo(x + d, y);
          ctx!.moveTo(x, y - d);
          ctx!.lineTo(x, y + d);
          ctx!.stroke();
        }

        // hairline diffraction ticks + reticle on the core (idle, post-ignition)
        if (s.id === "core") {
          ctx!.strokeStyle = `rgba(${SILVER},${0.5 * tw})`;
          ctx!.lineWidth = 1;
          const d = r * 3.4;
          ctx!.beginPath();
          ctx!.moveTo(x - d, y);
          ctx!.lineTo(x + d, y);
          ctx!.moveTo(x, y - d);
          ctx!.lineTo(x, y + d);
          ctx!.stroke();
          // selection reticle around the core
          ctx!.strokeStyle = `rgba(${SILVER},${0.4 * reveal})`;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 2.6, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }

      // ---- the sentinel sweep (slow azimuth sweep line) -------------------
      if (!reduce && p.sweep > 0) {
        const a = (t * 0.16) % (Math.PI * 2); // ~39s per revolution
        const grad = ctx!.createLinearGradient(
          cx,
          cy,
          cx + Math.cos(a) * ringR,
          cy + Math.sin(a) * ringR,
        );
        grad.addColorStop(0, `rgba(${SILVER},${0.32 * p.sweep})`);
        grad.addColorStop(1, `rgba(${SILVER},0)`);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.4;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
        ctx!.stroke();
        // a faint trailing wedge behind the sweep
        ctx!.fillStyle = `rgba(${SILVER},${0.025 * p.sweep})`;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.arc(cx, cy, ringR, a - 0.34, a);
        ctx!.closePath();
        ctx!.fill();
      } else if (reduce) {
        // Static settled sweep line for the reduced-motion final frame.
        const a = -Math.PI / 3;
        ctx!.strokeStyle = `rgba(${SILVER},0.18)`;
        ctx!.lineWidth = 1.4;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
        ctx!.stroke();
      }

      if (running && !reduce) raf = requestAnimationFrame(draw);
    }

    resize();
    draw(performance.now());

    // Pause the loop off-screen / when hidden; redraw a fresh frame on resume.
    let io: IntersectionObserver | null = null;
    const setRunning = (next: boolean) => {
      if (next === running) return;
      running = next;
      if (running && !reduce) {
        raf = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(raf);
      }
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

    // ResizeObserver keeps the backing store matched to the element box at any
    // DPR (sharper + cheaper than listening to window resize alone).
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        resize();
        draw(performance.now());
      });
      ro.observe(canvas);
    }
    const onResize = () => {
      resize();
      draw(performance.now());
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ display: "block", width: "100%", height: "100%" }}
    />
  );
}
