"use client";

import { AnimatePresence, m } from "framer-motion";
import { ShieldX, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { GlowButton } from "./GlowButton";
import { EASE_OUT_EXPO } from "@/lib/motion";

/** Minimal shape the preview panel needs; a real GraphNode satisfies it. */
export interface InspectorNode {
  id: string;
  /** Display title, e.g. "MEMORY NODE". */
  title: string;
  /** Node type label, e.g. "poisoned_memory". */
  type: string;
  sourceChunkId?: string | null;
  tenant?: string | null;
  subTenant?: string | null;
  relevancy?: number | null;
  /** Free-text status; "TAINTED" renders as a white-outline pill. */
  status?: string | null;
  riskReason?: string | null;
  tainted?: boolean;
}

interface NodeInspectorPreviewProps {
  node: InspectorNode | null;
  onClose?: () => void;
  onQuarantine?: (node: InspectorNode) => void;
  className?: string;
}

interface FieldRow {
  label: string;
  value: string | null | undefined;
}

/**
 * Right-side detail panel for a selected artifact-tree node. Slides in with
 * AnimatePresence when `node` is non-null. Shows node type, source chunk,
 * tenant / sub-tenant, relevancy, a status pill ("TAINTED" as a white-outline
 * pill), the risk reason, and a monochrome danger "Quarantine" action. Empty
 * fields are omitted. Strictly black/white/silver, danger is a brighter
 * outline + glow, never red.
 */
export function NodeInspectorPreview({
  node,
  onClose,
  onQuarantine,
  className,
}: NodeInspectorPreviewProps) {
  return (
    <AnimatePresence>
      {node && (
        <m.aside
          key={node.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.35, ease: EASE_OUT_EXPO }}
          className={cn(
            "cockpit-card flex w-full max-w-xs flex-col gap-4 p-5",
            node.tainted && "border-white/40",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="cockpit-eyebrow">{node.type}</div>
              <div className="mt-1 truncate text-lg font-semibold tracking-tight text-ink">
                {node.title}
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close inspector"
                className="shrink-0 rounded-lg border border-hairline p-1.5 text-muted outline-none transition hover:border-hairline-strong hover:text-ink focus-visible:ring-2 focus-visible:ring-white/70"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            )}
          </div>

          {node.status && (
            <span
              className={cn(
                "mono inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em]",
                node.tainted
                  ? "border-white/60 bg-white/[.08] text-ink shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  : "border-hairline-strong bg-white/[.04] text-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  node.tainted
                    ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                    : "bg-white/55",
                )}
              />
              {node.status}
            </span>
          )}

          <dl className="flex flex-col divide-y divide-white/[0.06]">
            {(
              [
                { label: "Source chunk", value: node.sourceChunkId },
                { label: "Tenant", value: node.tenant },
                { label: "Sub-tenant", value: node.subTenant },
                {
                  label: "Relevancy score",
                  value:
                    node.relevancy != null ? node.relevancy.toFixed(2) : null,
                },
                { label: "Risk reason", value: node.riskReason },
              ] satisfies FieldRow[]
            )
              .filter((row) => row.value)
              .map((row) => (
                <div key={row.label} className="flex flex-col gap-1 py-2.5">
                  <dt className="cockpit-eyebrow">{row.label}</dt>
                  <dd className="mono break-words text-[12.5px] text-ink/85">
                    {row.value}
                  </dd>
                </div>
              ))}
          </dl>

          {onQuarantine && (
            <GlowButton
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => onQuarantine(node)}
              iconLeft={<ShieldX className="h-4 w-4" strokeWidth={1.8} />}
            >
              Quarantine memory
            </GlowButton>
          )}
        </m.aside>
      )}
    </AnimatePresence>
  );
}
