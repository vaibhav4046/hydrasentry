"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Crosshair,
  ShieldCheck,
  Skull,
  GitBranch,
  AlertOctagon,
  Zap,
  ShieldAlert,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { FlowNodeData, GraphRole } from "@/lib/graph";

const ROLE_META: Record<GraphRole, { Icon: LucideIcon; kicker: string }> = {
  user_task: { Icon: Crosshair, kicker: "user task" },
  clean_policy: { Icon: ShieldCheck, kicker: "clean policy" },
  poisoned_memory: { Icon: Skull, kicker: "poisoned memory" },
  query_path: { Icon: GitBranch, kicker: "query path" },
  policy_conflict: { Icon: AlertOctagon, kicker: "policy conflict" },
  unsafe_tool_action: { Icon: Zap, kicker: "unsafe action" },
  mcp_firewall: { Icon: ShieldAlert, kicker: "mcp firewall" },
  report: { Icon: FileText, kicker: "evidence report" },
};

/**
 * Custom monochrome graph node. Tainted/poisoned nodes get a heavier border and
 * a slow pulsing white halo; the firewall node renders a shield with a BLOCKED
 * badge and a thick white outline. All severity is brightness/border/motion
 * never hue. Clicking is wired by the canvas via onNodeClick.
 */
export function HydraNode({ data, selected }: NodeProps) {
  const { node, role, tainted, blocked } = data as FlowNodeData;
  const meta = ROLE_META[role];
  const Icon = meta.Icon;
  const isFirewall = role === "mcp_firewall";

  return (
    <div
      className={cn(
        "hydra-flow-node relative w-[208px] rounded-2xl border bg-panel/85 px-3.5 py-3 backdrop-blur-xl transition",
        "shadow-[0_18px_50px_rgba(0,0,0,0.55)]",
        tainted
          ? "border-white/70"
          : blocked
            ? "border-white"
            : "border-hairline-strong",
        selected && "ring-2 ring-white/80",
      )}
    >
      {tainted && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-2xl bg-white/20 blur-md motion-safe:animate-pulse"
        />
      )}
      <Handle
        type="target"
        position={Position.Left}
        className="!border-white/30 !bg-white/40"
      />
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-lg border",
            tainted || blocked
              ? "border-white/60 bg-white/[.12]"
              : "border-hairline bg-white/[.04]",
          )}
        >
          <Icon
            className={cn("h-4 w-4", tainted || blocked ? "text-ink" : "text-muted")}
            strokeWidth={1.7}
          />
        </span>
        <div className="min-w-0">
          <div className="mono text-[9px] uppercase tracking-[0.16em] text-faint">
            {meta.kicker}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold tracking-tight text-ink">
            {node.label}
          </div>
          <div className="mono mt-0.5 truncate text-[10px] text-muted">
            {node.id}
          </div>
        </div>
      </div>

      {isFirewall && blocked && (
        <div className="mono mt-2.5 flex items-center justify-center rounded-md border border-white bg-white/[.1] py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-ink">
          Blocked
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!border-white/30 !bg-white/40"
      />
    </div>
  );
}
