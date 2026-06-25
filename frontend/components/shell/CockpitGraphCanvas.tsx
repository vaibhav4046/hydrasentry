"use client";

import { useEffect, useRef } from "react";

/**
 * Castellan Context Graph canvas — the source's neural memory-core renderer
 * ported 1:1 into a React ref/rAF effect. Draws the key nodes (core, user,
 * clean, poison, query, conflict, unsafe, firewall, report) plus filler nodes,
 * curved quadratic edges with traveling pulse particles, a twinkling starfield,
 * pointer parallax, and hover/selection highlighting. Tainted edges/nodes light
 * up bright white when `poisoned`. Clicking a key node reports its id via
 * onInspect; hovering dims the rest of the graph. Monochrome only.
 *
 * This is a faithful port of the standalone's _buildGraph/_draw/_tryCanvas so
 * the Memory Graph screen matches the source pixel-close.
 */

type NodeKind = "" | "core" | "poison" | "fw";
interface GNode {
  id: string;
  x: number;
  y: number;
  key: boolean;
  kind: NodeKind;
  seed: number;
}
interface GEdge {
  a: string;
  b: string;
  taint: boolean;
  pulse: boolean;
  off: number;
  curve: number;
}

interface CockpitGraphCanvasProps {
  poisoned: boolean;
  selectedId: string;
  onInspect: (id: string) => void;
}

const LABELS: Record<string, string> = {
  core: "memory core",
  user: "user_task",
  clean: "policy_v2",
  poison: "poisoned_mem",
  query: "query_path",
  conflict: "policy_conflict",
  unsafe: "unsafe_action",
  fw: "mcp_firewall",
  report: "report",
};

const TAINT_SET = new Set(["poison", "query", "i1", "core", "i5", "conflict", "unsafe", "fw"]);

function buildNodes(): GNode[] {
  const N = (id: string, x: number, y: number, key?: number, kind?: NodeKind): GNode => ({
    id,
    x,
    y,
    key: !!key,
    kind: kind || "",
    seed: id.length * 1.7 + x * 9 + y * 5,
  });
  return [
    N("core", 0.5, 0.5, 1, "core"),
    N("user", 0.1, 0.34, 1),
    N("clean", 0.15, 0.72, 1),
    N("poison", 0.3, 0.83, 1, "poison"),
    N("query", 0.4, 0.6, 1),
    N("conflict", 0.61, 0.29, 1),
    N("unsafe", 0.74, 0.8, 1),
    N("fw", 0.87, 0.5, 1, "fw"),
    N("report", 0.92, 0.25, 1),
    N("i1", 0.41, 0.45),
    N("i2", 0.58, 0.55),
    N("i3", 0.49, 0.64),
    N("i4", 0.45, 0.39),
    N("i5", 0.62, 0.45),
    N("f1", 0.23, 0.5),
    N("f2", 0.34, 0.24),
    N("f3", 0.68, 0.67),
    N("f4", 0.8, 0.36),
    N("f5", 0.27, 0.65),
    N("f6", 0.7, 0.19),
    N("f7", 0.84, 0.65),
    N("f8", 0.19, 0.46),
    N("f9", 0.55, 0.17),
    N("f10", 0.37, 0.74),
  ];
}

function buildEdges(): GEdge[] {
  const E = (a: string, b: string, taint?: number, pulse?: number): GEdge => ({
    a,
    b,
    taint: !!taint,
    pulse: !!pulse,
    off: 0,
    curve: 0,
  });
  const edges = [
    E("poison", "query", 1, 1),
    E("query", "i1", 1, 1),
    E("i1", "core", 1, 1),
    E("core", "i5", 1, 1),
    E("i5", "conflict", 1, 1),
    E("conflict", "unsafe", 1, 1),
    E("core", "fw", 1, 1),
    E("core", "i2", 0, 1),
    E("core", "i3", 0, 1),
    E("core", "i4", 0, 1),
    E("user", "i4", 0, 1),
    E("user", "f8"),
    E("f8", "f1"),
    E("f1", "i1"),
    E("f1", "f5"),
    E("clean", "f5", 0, 1),
    E("f5", "i3"),
    E("clean", "f10"),
    E("f10", "query"),
    E("i2", "f3"),
    E("f3", "i3"),
    E("i2", "f7"),
    E("f7", "unsafe"),
    E("i5", "f4", 0, 1),
    E("f4", "report", 0, 1),
    E("fw", "report"),
    E("fw", "f7"),
    E("i2", "fw"),
    E("conflict", "f6"),
    E("f6", "report"),
    E("f2", "query"),
    E("f2", "i4"),
    E("user", "f2"),
    E("f9", "conflict"),
    E("f9", "f6"),
    E("f3", "f10"),
  ];
  edges.forEach((e, i) => {
    e.off = (i * 0.137) % 1;
    e.curve = ((i * 37) % 2 ? 1 : -1) * (10 + ((i * 13) % 18));
  });
  return edges;
}

export function CockpitGraphCanvas({ poisoned, selectedId, onInspect }: CockpitGraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Latest props read inside the rAF loop without re-subscribing. Synced in an
  // effect (not during render) so the loop always sees current values.
  const stateRef = useRef({ poisoned, selectedId });
  const onInspectRef = useRef(onInspect);
  useEffect(() => {
    stateRef.current = { poisoned, selectedId };
    onInspectRef.current = onInspect;
  }, [poisoned, selectedId, onInspect]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = buildNodes();
    const edges = buildEdges();
    const adj: Record<string, string[]> = {};
    nodes.forEach((n) => (adj[n.id] = []));
    edges.forEach((e) => {
      adj[e.a].push(e.b);
      adj[e.b].push(e.a);
    });
    const gstars = Array.from({ length: 70 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.2,
      ph: Math.random() * 6.283,
      sp: 0.5 + Math.random() * 1.2,
    }));

    let w = 0;
    let h = 0;
    let positions: { id: string; key: boolean; kind: NodeKind; x: number; y: number }[] = [];
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, mx: -999, my: -999 };

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      w = r.width;
      h = r.height;
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width - 0.5;
      mouse.ty = (e.clientY - r.top) / r.height - 0.5;
      mouse.mx = e.clientX - r.left;
      mouse.my = e.clientY - r.top;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    canvas.onmouseleave = () => {
      mouse.mx = -999;
      mouse.my = -999;
    };
    canvas.onclick = (e) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      let best: (typeof positions)[number] | null = null;
      let bd = 9999;
      positions.forEach((pp) => {
        if (!pp.key) return;
        const d = Math.hypot(pp.x - mx, pp.y - my);
        if (d < bd) {
          bd = d;
          best = pp;
        }
      });
      if (best && bd < 26) onInspectRef.current((best as { id: string }).id);
    };

    const draw = (t: number) => {
      const P = stateRef.current.poisoned;
      const sel = stateRef.current.selectedId;
      if (!w) return;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      mouse.x += ((mouse.tx || 0) - mouse.x) * 0.05;
      mouse.y += ((mouse.ty || 0) - mouse.y) * 0.05;
      const ox = -mouse.x * 9;
      const oy = -mouse.y * 7;

      gstars.forEach((s) => {
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph));
        ctx.fillStyle = `rgba(255,255,255,${0.1 * tw})`;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, 6.283);
        ctx.fill();
      });

      const pos: Record<string, { id: string; key: boolean; kind: NodeKind; x: number; y: number }> = {};
      const arr: typeof positions = [];
      nodes.forEach((n) => {
        const amp = n.key ? 2.6 : 4.2;
        const x = n.x * w + Math.sin(t * 0.00042 + n.seed) * amp + ox;
        const y = n.y * h + Math.cos(t * 0.00037 + n.seed * 1.3) * amp + oy;
        const o = { id: n.id, key: n.key, kind: n.kind, x, y };
        pos[n.id] = o;
        arr.push(o);
      });
      positions = arr;

      let hover: (typeof arr)[number] | null = null;
      if (mouse.mx > -900) {
        let bd = 22;
        arr.forEach((pp) => {
          const d = Math.hypot(pp.x - mouse.mx, pp.y - mouse.my);
          if (d < bd) {
            bd = d;
            hover = pp;
          }
        });
      }
      const hv = hover as (typeof arr)[number] | null;
      const hl = new Set<string>();
      if (hv) {
        hl.add(hv.id);
        (adj[hv.id] || []).forEach((n) => hl.add(n));
      }

      edges.forEach((e) => {
        const a = pos[e.a];
        const b = pos[e.b];
        if (!a || !b) return;
        const tn = e.taint && P;
        const onHover = hv && (e.a === hv.id || e.b === hv.id);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const nl = Math.hypot(-dy, dx) || 1;
        const cx = mx + (-dy / nl) * e.curve * 0.5;
        const cy = my + (dx / nl) * e.curve * 0.5;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(cx, cy, b.x, b.y);
        if (tn) {
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1.6;
          ctx.shadowColor = "rgba(255,255,255,0.8)";
          ctx.shadowBlur = 9;
        } else if (onHover) {
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.lineWidth = 1.2;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = e.taint ? "rgba(220,228,240,0.13)" : "rgba(200,212,230,0.08)";
          ctx.lineWidth = 0.7;
          ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        if (!e.pulse && !tn) return;
        const sp = tn ? 0.0005 : 0.00016;
        const cnt = tn ? 3 : 1;
        for (let k = 0; k < cnt; k++) {
          const tt = (t * sp + e.off + k / cnt) % 1;
          const qx = (1 - tt) * (1 - tt) * a.x + 2 * (1 - tt) * tt * cx + tt * tt * b.x;
          const qy = (1 - tt) * (1 - tt) * a.y + 2 * (1 - tt) * tt * cy + tt * tt * b.y;
          const rr = tn ? 2.2 : 1.3;
          const g = ctx.createRadialGradient(qx, qy, 0, qx, qy, rr * 4);
          g.addColorStop(0, tn ? "rgba(255,255,255,0.95)" : "rgba(220,228,240,0.5)");
          g.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(qx, qy, rr * 4, 0, 6.283);
          ctx.fill();
        }
      });

      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      nodes.forEach((n) => {
        const pp = pos[n.id];
        const tn = P && TAINT_SET.has(n.id);
        const isSel = sel === n.id;
        const hov2 = hv && hv.id === n.id;
        const dim = hv && !hl.has(n.id);
        const a = dim ? 0.28 : 1;
        const r = n.key ? 3.4 : 1.8;
        const gr = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, n.key ? 15 : 7);
        gr.addColorStop(0, `rgba(234,240,250,${(tn ? 0.5 : n.key ? 0.28 : 0.14) * a})`);
        gr.addColorStop(1, "rgba(234,240,250,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, n.key ? 15 : 7, 0, 6.283);
        ctx.fill();
        if (n.kind === "fw") {
          ctx.save();
          ctx.translate(pp.x, pp.y);
          ctx.rotate(Math.PI / 4);
          const s = P ? 6.5 : 5;
          ctx.strokeStyle = `rgba(255,255,255,${(P ? 0.95 : 0.6) * a})`;
          ctx.lineWidth = P ? 2 : 1.4;
          ctx.strokeRect(-s, -s, s * 2, s * 2);
          ctx.restore();
          if (P) {
            const pr = 7 + ((t * 0.004) % 1) * 9;
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, pr, 0, 6.283);
            ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ((t * 0.004) % 1))})`;
            ctx.lineWidth = 1.4;
            ctx.stroke();
          }
        } else {
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, r, 0, 6.283);
          ctx.fillStyle = tn ? "#fff" : n.key ? `rgba(240,244,252,${a})` : `rgba(210,220,235,${0.65 * a})`;
          ctx.fill();
          if (n.kind === "poison" && P) {
            const pr = 6 + ((t * 0.003) % 1) * 11;
            ctx.beginPath();
            ctx.arc(pp.x, pp.y, pr, 0, 6.283);
            ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - ((t * 0.003) % 1))})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
        if (n.key) {
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, r + (isSel || hov2 ? 6 : 3.5), 0, 6.283);
          ctx.strokeStyle = isSel
            ? "rgba(255,255,255,0.95)"
            : hov2
              ? "rgba(255,255,255,0.7)"
              : tn
                ? "rgba(255,255,255,0.5)"
                : `rgba(220,228,240,${0.22 * a})`;
          ctx.lineWidth = isSel ? 1.6 : 1;
          ctx.stroke();
        }
        const lbl = LABELS[n.id] || (hov2 ? n.id : null);
        if (lbl) {
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.fillStyle = isSel || hov2 ? "rgba(255,255,255,0.95)" : `rgba(220,228,240,${0.4 * a})`;
          ctx.fillText(lbl, pp.x, pp.y + (n.key ? 9 : 7));
        }
      });
      ctx.textAlign = "left";
    };

    let raf = 0;
    const loop = (t: number) => {
      if (!document.hidden) draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%", height: 560, willChange: "transform" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair" }}
      />
    </div>
  );
}
