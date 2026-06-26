/**
 * Low-level cartographic drawing primitives for the Context Graph star-atlas
 * (AtlasStarChart). Kept separate from the React component so the canvas file
 * stays focused on the rAF lifecycle + interaction, and these pure 2D routines
 * can be reasoned about on their own. Pure monochrome silver/white on void.
 */
import type { StarKind } from "@/lib/cockpit/atlasGraphModel";

export const SILVER = "234,240,250"; // --hs-accent-bright as an rgb tuple

/** Glyph radius (px) for a star of the given magnitude at the chart's scale. */
export function radiusFor(mag: number, scale: number): number {
  // Brightest (mag 0) ~ 5.0px, faintest field (mag ~5) ~ 0.8px.
  return Math.max(0.8, (5.0 - mag * 0.82) * scale);
}

/** Plot-rectangle geometry shared by the canvas and DOM-label overlay. */
export interface Plot {
  ox: number;
  oy: number;
  size: number;
  scale: number;
  cx: number;
  cy: number;
}

/** Compute the centred square plot rectangle inside a w×h canvas. */
export function computePlot(w: number, h: number): Plot {
  const pad = Math.min(w, h) * 0.085;
  const size = Math.min(w, h) - pad * 2;
  const ox = (w - size) / 2;
  const oy = (h - size) / 2;
  return { ox, oy, size, scale: size / 620, cx: ox + size / 2, cy: oy + size / 2 };
}

/** Draw the engraved instrument frame: azimuth rings + RA/Dec ticks. */
export function drawFrame(ctx: CanvasRenderingContext2D, p: Plot): void {
  const { cx, cy, size } = p;
  const ringR = size * 0.495;

  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${SILVER},0.14)`;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = `rgba(${SILVER},0.08)`;
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, ringR * 0.4, 0, Math.PI * 2);
  ctx.stroke();

  // Azimuth ticks around the outer ring.
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const major = i % 6 === 0;
    const r1 = ringR;
    const r2 = ringR + (major ? size * 0.02 : size * 0.01);
    ctx.strokeStyle = `rgba(${SILVER},${major ? 0.3 : 0.12})`;
    ctx.lineWidth = major ? 1.1 : 0.8;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    ctx.stroke();
  }

  // Faint RA/Dec crosshair through the core.
  ctx.strokeStyle = `rgba(${SILVER},0.05)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p.ox, cy);
  ctx.lineTo(p.ox + size, cy);
  ctx.moveTo(cx, p.oy);
  ctx.lineTo(cx, p.oy + size);
  ctx.stroke();
}

/** Draw the slow sentinel sweep line + trailing wedge. */
export function drawSweep(ctx: CanvasRenderingContext2D, p: Plot, t: number): void {
  const { cx, cy, size } = p;
  const ringR = size * 0.495;
  const a = (t * 0.16) % (Math.PI * 2); // ~39s per revolution
  const grad = ctx.createLinearGradient(
    cx,
    cy,
    cx + Math.cos(a) * ringR,
    cy + Math.sin(a) * ringR,
  );
  grad.addColorStop(0, `rgba(${SILVER},0.26)`);
  grad.addColorStop(1, `rgba(${SILVER},0)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * ringR, cy + Math.sin(a) * ringR);
  ctx.stroke();
  ctx.fillStyle = `rgba(${SILVER},0.02)`;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, ringR, a - 0.32, a);
  ctx.closePath();
  ctx.fill();
}

/** A small mono glyph drawn inside a star, identifying its kind. */
export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  kind: StarKind,
  x: number,
  y: number,
  r: number,
  alpha: number,
): void {
  ctx.save();
  ctx.strokeStyle = `rgba(${SILVER},${alpha})`;
  ctx.fillStyle = `rgba(${SILVER},${alpha})`;
  ctx.lineWidth = Math.max(0.8, r * 0.18);
  const g = r * 1.5; // glyph extent

  switch (kind) {
    case "guardian": {
      // shield outline
      ctx.beginPath();
      ctx.moveTo(x, y - g);
      ctx.lineTo(x + g * 0.82, y - g * 0.4);
      ctx.lineTo(x + g * 0.82, y + g * 0.2);
      ctx.quadraticCurveTo(x + g * 0.82, y + g, x, y + g * 1.15);
      ctx.quadraticCurveTo(x - g * 0.82, y + g, x - g * 0.82, y + g * 0.2);
      ctx.lineTo(x - g * 0.82, y - g * 0.4);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "origin": {
      // crosshair target
      ctx.beginPath();
      ctx.arc(x, y, g * 0.7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - g, y);
      ctx.lineTo(x + g, y);
      ctx.moveTo(x, y - g);
      ctx.lineTo(x, y + g);
      ctx.stroke();
      break;
    }
    case "policy":
    case "policy_stale":
    case "doc": {
      // document page
      ctx.strokeRect(x - g * 0.62, y - g * 0.85, g * 1.24, g * 1.7);
      ctx.beginPath();
      ctx.moveTo(x - g * 0.3, y - g * 0.3);
      ctx.lineTo(x + g * 0.3, y - g * 0.3);
      ctx.moveTo(x - g * 0.3, y + g * 0.1);
      ctx.lineTo(x + g * 0.3, y + g * 0.1);
      ctx.stroke();
      break;
    }
    case "memory":
    case "chunk": {
      // memory cell (rounded square)
      roundRect(ctx, x - g * 0.72, y - g * 0.72, g * 1.44, g * 1.44, g * 0.35);
      ctx.stroke();
      break;
    }
    case "path": {
      // branching path (3 hops)
      ctx.beginPath();
      ctx.moveTo(x - g, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x + g * 0.7, y - g * 0.7);
      ctx.moveTo(x, y);
      ctx.lineTo(x + g * 0.7, y + g * 0.7);
      ctx.stroke();
      dot(ctx, x - g, y, r * 0.3);
      dot(ctx, x + g * 0.7, y - g * 0.7, r * 0.3);
      dot(ctx, x + g * 0.7, y + g * 0.7, r * 0.3);
      break;
    }
    case "conflict": {
      // warning octagon-ish: a triangle with a stem
      ctx.beginPath();
      ctx.moveTo(x, y - g);
      ctx.lineTo(x + g, y + g * 0.7);
      ctx.lineTo(x - g, y + g * 0.7);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y - g * 0.3);
      ctx.lineTo(x, y + g * 0.2);
      ctx.stroke();
      break;
    }
    case "action": {
      // bolt
      ctx.beginPath();
      ctx.moveTo(x + g * 0.3, y - g);
      ctx.lineTo(x - g * 0.5, y + g * 0.1);
      ctx.lineTo(x + g * 0.05, y + g * 0.1);
      ctx.lineTo(x - g * 0.3, y + g);
      ctx.lineTo(x + g * 0.55, y - g * 0.1);
      ctx.lineTo(x, y - g * 0.1);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case "quarantine": {
      // dashed containment ring
      ctx.setLineDash([r * 0.5, r * 0.5]);
      ctx.beginPath();
      ctx.arc(x, y, g * 0.85, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "risk": {
      // gauge tick
      ctx.beginPath();
      ctx.arc(x, y, g * 0.85, Math.PI * 0.85, Math.PI * 2.15);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + g * 0.6, y - g * 0.5);
      ctx.stroke();
      break;
    }
    case "report": {
      // signed document with a check
      ctx.strokeRect(x - g * 0.6, y - g * 0.85, g * 1.2, g * 1.7);
      ctx.beginPath();
      ctx.moveTo(x - g * 0.3, y + g * 0.2);
      ctx.lineTo(x - g * 0.05, y + g * 0.5);
      ctx.lineTo(x + g * 0.4, y - g * 0.15);
      ctx.stroke();
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.6, r), 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw a tiny directed arrowhead at (x,y) pointing along angle `a`. */
export function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  a: number,
  size: number,
  rgba: string,
): void {
  const w = 0.5; // half-spread (radians)
  ctx.fillStyle = rgba;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(a - w), y - size * Math.sin(a - w));
  ctx.lineTo(x - size * Math.cos(a + w), y - size * Math.sin(a + w));
  ctx.closePath();
  ctx.fill();
}
