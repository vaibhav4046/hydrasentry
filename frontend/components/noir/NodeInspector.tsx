"use client";

import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { StatusPill, type StatusTone } from "./StatusPill";
import type { GraphNode, TrustLevel } from "@/lib/types";

interface NodeInspectorProps {
  node: GraphNode | null;
  onClose?: () => void;
  className?: string;
}

const TRUST_TONE: Record<TrustLevel, StatusTone> = {
  trusted: "safe",
  poisoned: "critical",
  stale: "warn",
};

interface FieldRow {
  label: string;
  value: string | null | undefined;
}

/**
 * Right-side panel that renders a selected graph node's fields. Slides in with
 * AnimatePresence when `node` is non-null. Field rows omit empty values. The
 * trust level drives a StatusPill tone (brightness, not hue).
 */
export function NodeInspector({ node, onClose, className }: NodeInspectorProps) {
  return (
    <AnimatePresence>
      {node && (
        <m.aside
          key={node.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "hydra-glass rounded-xl2 flex w-full max-w-sm flex-col gap-4 p-5",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mono text-[11px] uppercase tracking-[0.16em] text-faint">
                {node.type}
              </div>
              <div className="mt-1 text-lg font-semibold tracking-tight text-ink">
                {node.label}
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close inspector"
              className="rounded-lg border border-hairline p-1.5 text-muted transition hover:border-hairline-strong hover:text-ink"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>

          <StatusPill tone={TRUST_TONE[node.trust]} label={node.trust} />

          <dl className="flex flex-col divide-y divide-white/[0.06]">
            {(
              [
                { label: "Status", value: node.status },
                { label: "Source chunk", value: node.source_chunk_id },
                { label: "Tenant", value: node.tenant_id },
                { label: "Sub-tenant", value: node.sub_tenant_id },
                { label: "Policy version", value: node.policy_version },
                { label: "Risk reason", value: node.risk_reason },
              ] satisfies FieldRow[]
            )
              .filter((row) => row.value)
              .map((row) => (
                <div
                  key={row.label}
                  className="flex flex-col gap-1 py-2.5"
                >
                  <dt className="mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
                    {row.label}
                  </dt>
                  <dd className="mono break-words text-[12.5px] text-ink/85">
                    {row.value}
                  </dd>
                </div>
              ))}
          </dl>
        </m.aside>
      )}
    </AnimatePresence>
  );
}
