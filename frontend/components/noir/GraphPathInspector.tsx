"use client";

/**
 * GraphPathInspector — a compact, mono read-out of the tainted query path that
 * carried the poison to the unsafe action. It surfaces the exact hop chain the
 * ArtifactTreeGraph highlights at the GRAPH/FIREWALL stages, so the "trace the
 * graph path" claim is backed by a concrete, labelled triplet sequence rather
 * than only a picture.
 *
 * The chain is the deterministic memory_poisoning_refund path:
 *   poisoned memory → chunk → query_path (0.87) → policy conflict →
 *   approve_refund() → MCP firewall block.
 *
 * Pure presentation, monochrome, danger as intensity. Reduced motion: the rows
 * are fully visible with no entrance (the stagger is decoration only).
 */
import { m, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";

interface PathHop {
  node: string;
  detail: string;
  /** Reads "hot" once the poison is on this hop. */
  hot: boolean;
  /** True for the severing firewall hop. */
  blocked?: boolean;
}

const HOPS: PathHop[] = [
  { node: "poisoned_memory", detail: "memory_91ab23", hot: true },
  { node: "chunk", detail: "chunk_7f3a1c", hot: true },
  { node: "query_path", detail: "3 hops · score 0.87", hot: true },
  { node: "policy_conflict", detail: "contradicts refund policy v2.1", hot: true },
  { node: "unsafe_tool_action", detail: "approve_refund()", hot: true },
  { node: "mcp_firewall", detail: "action blocked", hot: true, blocked: true },
];

interface GraphPathInspectorProps {
  /** Honest provenance label: derived demo path vs real HydraDB query_paths. */
  derived?: boolean;
  className?: string;
}

export function GraphPathInspector({
  derived = true,
  className,
}: GraphPathInspectorProps) {
  const prefersReduced = useReducedMotion();
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-white/[0.015] p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="mono text-[9px] uppercase tracking-[0.2em] text-faint">
          Tainted query path
        </span>
        <span
          className="mono text-[8.5px] uppercase tracking-[0.14em] text-faint"
          title={
            derived
              ? "Derived scenario graph (HydraDB not in real mode)."
              : "Built from live HydraDB query_paths."
          }
        >
          {derived ? "derived · scenario" : "real query_paths"}
        </span>
      </div>

      <ol className="flex flex-col gap-1.5">
        {HOPS.map((hop, i) => (
          <m.li
            key={hop.node}
            initial={prefersReduced ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.4,
              ease: EASE_OUT_EXPO,
              delay: prefersReduced ? 0 : i * 0.05,
            }}
            className="flex items-center gap-2.5"
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                hop.blocked ? "bg-white" : hop.hot ? "bg-white/85" : "bg-white/30",
              )}
              style={
                hop.hot
                  ? { boxShadow: "0 0 10px rgba(255,255,255,0.55)" }
                  : undefined
              }
            />
            <span
              className={cn(
                "mono text-[11px]",
                hop.blocked ? "text-ink" : "text-silver",
              )}
            >
              {hop.node}
            </span>
            <span aria-hidden className="text-faint">·</span>
            <span className="text-[11px] text-muted">{hop.detail}</span>
          </m.li>
        ))}
      </ol>
    </div>
  );
}
