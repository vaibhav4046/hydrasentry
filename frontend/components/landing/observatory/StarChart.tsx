"use client";

import { useEffect, useRef } from "react";
import {
  CONSTELLATION,
  CONSTELLATION_LINES,
  buildFieldStars,
  type AtlasStar,
} from "./atlasData";

/**
 * The Memory Observatory star chart — the homepage centerpiece. A precise,
 * cartographic canvas (the antithesis of a glowing neural-network blob): an
 * azimuth ring with RA/Dec ticks, a sparse field of faint stars that twinkle
 * subtly, the "Memoria" constellation drawn as a thin silver figure with named
 * stars of varying magnitude, the tainted memory collapsing into a dark
 * crossed-out node, and a single slow sweep line — the sentinel watching the
 * chart.
 *
 * Implementation notes:
 *  - Canvas is DPR-scaled for crisp hairlines on retina; redrawn on resize.
 *  - The figure geometry is 100% deterministic (atlasData); only opacities and
 *    two slow angles animate, all on the compositor-free 2D context at 60fps.
 *  - rAF is paused when the chart scrolls off-screen or the tab is hidden, and
 *    fully disabled (one static frame drawn) under prefers-reduced-motion.
 *  - Pure monochrome (cool silver / white on void); danger = the star going
 *    dark + a severed dashed limb, never hue.
 */

const SILVER = "234,240,250"; // --hs-accent-bright as rgb tuple
const STAR_BY_ID = new Map<string, AtlasStar>(
  CONSTELLATION.map((s) => [s.id, s]),
);
const FIELD = buildFieldStars(96);

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
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const t = (now - start) / 1000;
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
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = `rgba(${SILVER},0.16)`;
      ctx!.beginPath();
      ctx!.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx!.stroke();

      ctx!.strokeStyle = `rgba(${SILVER},0.1)`;
      ctx!.beginPath();
      ctx!.arc(cx, cy, ringR * 0.74, 0, Math.PI * 2);
      ctx!.stroke();

      // Major + minor azimuth ticks around the outer ring.
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const major = i % 6 === 0;
        const r1 = ringR;
        const r2 = ringR + (major ? size * 0.022 : size * 0.011);
        ctx!.strokeStyle = `rgba(${SILVER},${major ? 0.32 : 0.14})`;
        ctx!.lineWidth = major ? 1.1 : 0.8;
        ctx!.beginPath();
        ctx!.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx!.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
        ctx!.stroke();
      }

      // Faint crosshair through the core (RA/Dec gridlines).
      ctx!.strokeStyle = `rgba(${SILVER},0.06)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(ox, py(CONSTELLATION[0].y));
      ctx!.lineTo(ox + size, py(CONSTELLATION[0].y));
      ctx!.moveTo(px(CONSTELLATION[0].x), oy);
      ctx!.lineTo(px(CONSTELLATION[0].x), oy + size);
      ctx!.stroke();

      // ---- faint star field (depth of the void) ---------------------------
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
        ctx!.fillStyle = `rgba(${SILVER},${(0.12 + base * 0.5) * tw})`;
        ctx!.beginPath();
        ctx!.arc(px(s.x), py(s.y), r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // ---- constellation lines (the figure) -------------------------------
      const taintFade = reduce
        ? 0.5
        : 0.32 + 0.18 * Math.sin(t * 1.6); // the severed limb flickers faintly
      for (const e of CONSTELLATION_LINES) {
        const a = STAR_BY_ID.get(e.from);
        const b = STAR_BY_ID.get(e.to);
        if (!a || !b) continue;
        ctx!.save();
        if (e.tainted) {
          ctx!.setLineDash([4 * scale, 5 * scale]);
          ctx!.lineDashOffset = reduce ? 0 : -t * 18;
          ctx!.strokeStyle = `rgba(${SILVER},${0.14 + taintFade * 0.12})`;
          ctx!.lineWidth = 1;
        } else {
          ctx!.strokeStyle = `rgba(${SILVER},0.3)`;
          ctx!.lineWidth = 1.1;
        }
        ctx!.beginPath();
        ctx!.moveTo(px(a.x), py(a.y));
        ctx!.lineTo(px(b.x), py(b.y));
        ctx!.stroke();
        ctx!.restore();
      }

      // ---- named constellation stars --------------------------------------
      for (const s of CONSTELLATION) {
        const x = px(s.x);
        const y = py(s.y);

        if (s.tainted) {
          // Collapsed star: a dark void disc, a thin broken ring, and a faint
          // cross — the memory going dark. A slow contraction sells "collapse".
          const pulse = reduce ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.3);
          const r = radiusFor(s.mag, scale) * (1.1 - pulse * 0.25);
          // dark core punched out of the field
          ctx!.fillStyle = "rgba(2,3,4,0.95)";
          ctx!.beginPath();
          ctx!.arc(x, y, r * 1.7, 0, Math.PI * 2);
          ctx!.fill();
          // broken collapse ring
          ctx!.strokeStyle = `rgba(${SILVER},${0.3 + pulse * 0.3})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 1.7, 0.4, Math.PI * 1.4);
          ctx!.stroke();
          ctx!.beginPath();
          ctx!.arc(x, y, r * 1.7, Math.PI * 1.6, Math.PI * 2.2);
          ctx!.stroke();
          // extinction cross
          const c = r * 1.1;
          ctx!.strokeStyle = `rgba(${SILVER},0.5)`;
          ctx!.beginPath();
          ctx!.moveTo(x - c, y - c);
          ctx!.lineTo(x + c, y + c);
          ctx!.moveTo(x + c, y - c);
          ctx!.lineTo(x - c, y + c);
          ctx!.stroke();
          continue;
        }

        const r = radiusFor(s.mag, scale);
        const tw = reduce ? 1 : 0.82 + 0.18 * Math.sin(t * 0.9 + s.x * 6);

        // soft halo for the brightest few
        if (s.mag < 2) {
          const g = ctx!.createRadialGradient(x, y, 0, x, y, r * 6);
          g.addColorStop(0, `rgba(${SILVER},${0.22 * tw})`);
          g.addColorStop(1, `rgba(${SILVER},0)`);
          ctx!.fillStyle = g;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 6, 0, Math.PI * 2);
          ctx!.fill();
        }

        // crisp white core
        ctx!.fillStyle = `rgba(255,255,255,${0.85 * tw})`;
        ctx!.beginPath();
        ctx!.arc(x, y, r, 0, Math.PI * 2);
        ctx!.fill();

        // hairline diffraction ticks on the core star
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
          ctx!.strokeStyle = `rgba(${SILVER},0.4)`;
          ctx!.beginPath();
          ctx!.arc(x, y, r * 2.6, 0, Math.PI * 2);
          ctx!.stroke();
        }
      }

      // ---- the sentinel sweep (slow azimuth sweep line) -------------------
      if (!reduce) {
        const a = (t * 0.16) % (Math.PI * 2); // ~39s per revolution
        const grad = ctx!.createLinearGradient(
          cx,
          cy,
          cx + Math.cos(a) * ringR,
          cy + Math.sin(a) * ringR,
        );
        grad.addColorStop(0, `rgba(${SILVER},0.32)`);
        grad.addColorStop(1, `rgba(${SILVER},0)`);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 1.4;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.lineTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
        ctx!.stroke();
        // a faint trailing wedge behind the sweep
        ctx!.fillStyle = `rgba(${SILVER},0.025)`;
        ctx!.beginPath();
        ctx!.moveTo(cx, cy);
        ctx!.arc(cx, cy, ringR, a - 0.34, a);
        ctx!.closePath();
        ctx!.fill();
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

    const onResize = () => {
      resize();
      draw(performance.now());
    };
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
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
