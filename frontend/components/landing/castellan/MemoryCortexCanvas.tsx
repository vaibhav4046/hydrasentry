"use client";

import { useEffect, useRef } from "react";

/**
 * Memory Cortex, the #product canvas, ported 1:1 from the design source's
 * interactive neural-graph (NOT WebGL: a single 2D <canvas> with one rAF loop).
 * A seeded cortex of neurons + synapses fires on hover; "Inject poisoned memory"
 * spreads a taint wavefront from the poison entry node to the core; "Block via
 * MCP" severs the edge at a containment ring; "Reset" clears it. The risk chip,
 * decision line, and graph tag react to state exactly as the source's _sim()
 * computes. Pointer parallax nudges the whole canvas. Geometry is seeded so SSR
 * and client agree; the loop parks when offscreen/hidden.
 *
 * State model mirrors the source: { poisoned, firewall, risk, running }. The
 * derived sim (winner/path/risk) drives both the canvas and the surrounding
 * chrome. Reduced-motion users get a composed static frame.
 */

interface Node {
  ux: number;
  uy: number;
  ph: number;
  sp: number;
  fr: number;
}
interface Edge {
  a: number;
  b: number;
  len: number;
  ph: number;
  sp: number;
}

interface Graph {
  nodes: Node[];
  edges: Edge[];
  coreIdx: number;
  poisonIdx: number;
  dist: number[];
  maxHop: number;
  fwHop: number;
  stars: { x: number; y: number; r: number; ph: number; sp: number }[];
  links: [number, number][];
}

/** Seeded LCG so the cortex geometry is identical on server and client. */
function buildGraph(): Graph {
  let s = 20240614 >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const lobes = [
    [-0.42, -0.02, 0.6, 0.74],
    [0.42, -0.02, 0.6, 0.74],
    [0, 0.12, 0.52, 0.6],
    [0, -0.2, 0.46, 0.42],
    [-0.66, 0.18, 0.34, 0.4],
    [0.66, 0.18, 0.34, 0.4],
  ];
  const inB = (x: number, y: number) =>
    lobes.some(
      (L) => ((x - L[0]) / L[2]) ** 2 + ((y - L[1]) / L[3]) ** 2 <= 1,
    );
  const N: Node[] = [];
  const step = 0.072;
  for (let gy = -1.0; gy <= 1.0; gy += step)
    for (let gx = -1.12; gx <= 1.12; gx += step) {
      const x = gx + (rnd() - 0.5) * step * 0.95;
      const y = gy + (rnd() - 0.5) * step * 0.95;
      if (!inB(x, y)) continue;
      if (Math.abs(x) < 0.05 && rnd() < 0.62) continue;
      N.push({ ux: x, uy: y, ph: rnd() * 6.283, sp: 0.5 + rnd() * 1.7, fr: rnd() });
    }
  const seen = new Set<string>();
  const ED: Edge[] = [];
  const adj: number[][] = N.map(() => []);
  for (let i = 0; i < N.length; i++) {
    const ds: [number, number][] = [];
    for (let j = 0; j < N.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(N[i].ux - N[j].ux, N[i].uy - N[j].uy);
      if (d < 0.19) ds.push([d, j]);
    }
    ds.sort((a, b) => a[0] - b[0]);
    const K = Math.min(4, ds.length);
    for (let k = 0; k < K; k++) {
      const j = ds[k][1];
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = a + "-" + b;
      if (seen.has(key)) continue;
      seen.add(key);
      ED.push({ a, b, len: ds[k][0], ph: 0, sp: 1 });
      adj[a].push(b);
      adj[b].push(a);
    }
  }
  ED.forEach((e, i) => {
    e.ph = (i * 0.146) % 1;
    e.sp = 0.5 + ((i * 7) % 5) / 5;
  });
  let ci = 0;
  let cb = 9;
  N.forEach((n, i) => {
    const d = Math.hypot(n.ux, n.uy * 1.1);
    if (d < cb) {
      cb = d;
      ci = i;
    }
  });
  let pi = 0;
  let pb = -9;
  N.forEach((n, i) => {
    const v = n.uy * 0.8 - Math.abs(n.ux) * 0.3;
    if (v > pb) {
      pb = v;
      pi = i;
    }
  });
  const dist = new Array(N.length).fill(-1);
  dist[pi] = 0;
  let head = 0;
  const q = [pi];
  while (head < q.length) {
    const u = q[head++];
    adj[u].forEach((v) => {
      if (dist[v] < 0) {
        dist[v] = dist[u] + 1;
        q.push(v);
      }
    });
  }
  let maxH = 0;
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0) dist[i] = 99;
    else if (dist[i] > maxH) maxH = dist[i];
  }
  const fwHop = Math.max(2, Math.round(dist[ci] * 0.66));
  const stars: Graph["stars"] = [];
  for (let i = 0; i < 90; i++)
    stars.push({
      x: rnd(),
      y: rnd(),
      r: 0.5 + rnd() * 1.4,
      ph: rnd() * 6.283,
      sp: 0.4 + rnd() * 1.2,
    });
  const links: [number, number][] = [];
  for (let i = 0; i < stars.length; i++)
    for (let j = i + 1; j < stars.length; j++) {
      const a = stars[i];
      const b = stars[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.12 && rnd() < 0.4)
        links.push([i, j]);
    }
  return { nodes: N, edges: ED, coreIdx: ci, poisonIdx: pi, dist, maxHop: maxH, fwHop, stars, links };
}

export interface CortexState {
  poisoned: boolean;
  firewall: boolean;
  risk: number;
  running: boolean;
}

interface MemoryCortexCanvasProps {
  state: CortexState;
  /** performance.now() of the last inject; drives the taint wavefront. */
  injectedAt: number | null;
}

export function MemoryCortexCanvas({ state, injectedAt }: MemoryCortexCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const stateRef = useRef(state);
  const injRef = useRef(injectedAt);

  // Keep the loop's refs in sync without touching them during render (the loop
  // reads the latest state/inject time each frame without re-subscribing).
  useEffect(() => {
    stateRef.current = state;
    injRef.current = injectedAt;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!graphRef.current) graphRef.current = buildGraph();

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, mx: -999, my: -999 };
    let inview = true;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width - 0.5;
      mouse.ty = (e.clientY - r.top) / r.height - 0.5;
      mouse.mx = e.clientX - r.left;
      mouse.my = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.mx = -999;
      mouse.my = -999;
    };

    const sim = () => {
      const g = graphRef.current!;
      const st = stateRef.current;
      const p = st.poisoned;
      const fw = st.firewall;
      const vipLive = p && !fw;
      const safeW = 1.4;
      const unsafeW = vipLive ? 1.9 : 0;
      const winner = unsafeW > safeW ? "unsafe" : "safe";
      const risk = winner === "unsafe" ? 87 : p && fw ? 9 : 12;
      return { p, fw, winner, risk, g };
    };

    const draw = (t: number) => {
      const g = graphRef.current!;
      if (!w || !g) return;
      const s = sim();
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      if (!reduce) {
        mouse.x += ((mouse.tx || 0) - mouse.x) * 0.05;
        mouse.y += ((mouse.ty || 0) - mouse.y) * 0.05;
        wrap.style.transform = `translate(${(-mouse.x * 7).toFixed(2)}px,${(-mouse.y * 5).toFixed(2)}px)`;
      }

      // constellation
      ctx.lineWidth = 1;
      g.links.forEach(([i, j]) => {
        const a = g.stars[i];
        const b = g.stars[j];
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      });
      g.stars.forEach((st) => {
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.001 * st.sp + st.ph));
        ctx.fillStyle = `rgba(255,255,255,${0.12 * tw})`;
        ctx.beginPath();
        ctx.arc(st.x * w, st.y * h, st.r, 0, 6.283);
        ctx.fill();
      });

      // cortex geometry
      const SX = Math.min(w * 0.34, h * 0.66);
      const SY = SX * 0.82;
      const cx = w * 0.5;
      const cy = h * 0.47;
      const pos = g.nodes.map((n) => ({ x: cx + n.ux * SX, y: cy + n.uy * SY }));

      // poison wave front
      let front = -1;
      if (s.p) {
        const e = Math.max(0, (t - (injRef.current || t)) / 950);
        front = Math.min(g.maxHop + 1, e * (g.maxHop + 1));
        if (s.fw) front = Math.min(front, g.fwHop);
      }
      let mux = -9;
      let muy = -9;
      if (mouse.mx > -900) {
        mux = (mouse.mx - cx) / SX;
        muy = (mouse.my - cy) / SY;
      }

      // activation per node
      const act = new Float32Array(g.nodes.length);
      for (let i = 0; i < g.nodes.length; i++) {
        const n = g.nodes[i];
        let a = 0.1 + 0.13 * (0.5 + 0.5 * Math.sin(t * 0.001 * n.sp + n.ph));
        const fire = Math.sin(t * 0.0013 * n.sp + n.fr * 9);
        if (fire > 0.93) a += 0.5 * (fire - 0.93) / 0.07;
        const dm = Math.hypot(n.ux - mux, n.uy - muy);
        if (dm < 0.26) a += (1 - dm / 0.26) * 0.75;
        if (front >= 0 && g.dist[i] <= front) {
          const d = front - g.dist[i];
          a = Math.max(a, d < 1 ? 0.55 + 0.45 * d : 1.0);
        }
        act[i] = Math.min(1.25, a);
      }

      // synapses
      for (let i = 0; i < g.edges.length; i++) {
        const e = g.edges[i];
        const A = pos[e.a];
        const B = pos[e.b];
        const al = (act[e.a] + act[e.b]) * 0.5;
        ctx.strokeStyle = `rgba(255,255,255,${0.035 + al * 0.5})`;
        ctx.lineWidth = al > 0.6 ? 1.2 : 0.7;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }

      // action potentials
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < g.edges.length; i++) {
        const e = g.edges[i];
        const al = (act[e.a] + act[e.b]) * 0.5;
        if (al < 0.45 && i % 4 !== 0) continue;
        const A = pos[e.a];
        const B = pos[e.b];
        const f = (t * 0.0006 * e.sp + e.ph) % 1;
        const x = A.x + (B.x - A.x) * f;
        const y = A.y + (B.y - A.y) * f;
        const r = al > 0.6 ? 2.6 : 1.5;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        grad.addColorStop(0, `rgba(255,255,255,${0.25 + al * 0.65})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, 6.283);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // neurons
      for (let i = 0; i < g.nodes.length; i++) {
        const p = pos[i];
        const a = act[i];
        const lum = Math.round(55 + a * 200);
        const r = 1.1 + a * 1.9;
        if (a > 0.55) {
          ctx.shadowColor = "rgba(255,255,255,0.6)";
          ctx.shadowBlur = a * 9;
        }
        ctx.fillStyle = `rgb(${lum},${lum},${Math.min(255, lum + 3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 6.283);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // firewall containment ring
      if (s.fw) {
        ctx.lineWidth = 1.4;
        for (let i = 0; i < g.nodes.length; i++) {
          if (g.dist[i] === g.fwHop) {
            const p = pos[i];
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4.5, 0, 6.283);
            ctx.stroke();
          }
        }
      }

      // core neuron
      {
        const p = pos[g.coreIdx];
        const coreHit = front >= 0 && g.dist[g.coreIdx] <= front;
        const pl = 1 + 0.12 * Math.sin(t * (coreHit ? 0.012 : 0.004));
        ctx.strokeStyle = `rgba(255,255,255,${coreHit ? 0.95 : 0.55})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8 * pl, 0, 6.283);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, 6.283);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.textAlign = "center";
        ctx.fillText("core", p.x, p.y + 18);
      }

      // poison entry marker
      {
        const p = pos[g.poisonIdx];
        ctx.strokeStyle = s.p ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, 6.283);
        ctx.stroke();
        ctx.font = "8px 'JetBrains Mono', monospace";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.textAlign = "center";
        ctx.fillText(s.p ? "poison" : "entry", p.x, p.y + 18);
        ctx.textAlign = "left";
      }
    };

    resize();
    let raf = 0;
    const loop = (t: number) => {
      if (!document.hidden && inview) draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    ro.observe(wrap);
    const io = new IntersectionObserver(
      (es) => {
        inview = es[0].isIntersecting;
      },
      { threshold: 0.01 },
    );
    io.observe(wrap);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseout", onLeave, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
    };
  }, []);

  return (
    <div
      id="hsCoreWrap"
      ref={wrapRef}
      style={{
        position: "relative",
        width: "100%",
        height: "clamp(390px,47vw,560px)",
        willChange: "transform",
        cursor: "crosshair",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
      <div
        className="mono"
        style={{
          position: "absolute",
          left: "18px",
          bottom: "14px",
          fontSize: "9px",
          letterSpacing: "0.16em",
          color: "rgba(220,228,240,0.4)",
          pointerEvents: "none",
        }}
      >
        HOVER TO FIRE NEURONS · INJECT TO SPREAD · BLOCK TO CONTAIN
      </div>
    </div>
  );
}

/** Derived display values for the surrounding chrome, mirrors the source. */
export function cortexVals(state: CortexState) {
  const { poisoned: p, firewall: fw, risk } = state;
  const hot = risk >= 40;
  return {
    risk,
    hot,
    riskState: hot ? "CRITICAL" : p && fw ? "CONTAINED" : "NOMINAL",
    chipColor: hot ? "#FFFFFF" : "#D9DEE7",
    chipBorder: hot ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.14)",
    chipBg: hot ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
    decisionText:
      risk >= 40 ? "approve_instant · forbidden" : "require_approval · safe",
    decisionColor: hot ? "#FFFFFF" : "#9BA3AF",
    graphTag: p
      ? fw
        ? "MCP FIREWALL · EDGE SEVERED"
        : "TAINTED PATH · LIVE"
      : "DERIVED RETRIEVAL GRAPH",
    graphTagColor: p ? "#EAF0FA" : "#9BA3AF",
    graphTagBorder: p ? "rgba(234,240,250,0.32)" : "rgba(255,255,255,0.12)",
    poisonCardBorder: hot ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.09)",
    poisonCardBg: hot ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.016)",
    poisonTag: p ? (fw ? "#C9D2E0" : "#FFFFFF") : "#5F6875",
    poisonState: p ? (fw ? "BLOCKED" : "UNSAFE") : "PENDING",
    poisonText: p
      ? fw
        ? '"Manager approval required. The unsafe VIP memory was withheld by the MCP firewall."'
        : '"Refund approved instantly. VIP customers always get instant refunds."'
      : "Inject poisoned memory to route the retrieval graph.",
    poisonTextColor: p ? "#F3F6FB" : "#5F6875",
  };
}
