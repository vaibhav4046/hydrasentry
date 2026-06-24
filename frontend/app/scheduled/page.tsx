"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Info } from "lucide-react";
import { PageShell } from "@/components/shared/PageShell";
import { InlineError } from "@/components/shared/StateNotice";
import { GlassPanel } from "@/components/noir/GlassPanel";
import { StatusPill, type StatusTone } from "@/components/noir/StatusPill";
import { ToggleSwitch } from "@/components/scheduled/ToggleSwitch";
import { getScheduledAgents, toggleAgent } from "@/lib/api";
import { formatTimestamp } from "@/lib/format";
import type { ScheduledAgent } from "@/lib/types";

// Scheduled Agents. Lists the six in-app simulated monitoring agents with their
// schedule, last/next run, latest result, action taken and status. Toggling an
// agent updates optimistically and reconciles with the backend response. A
// small note states plainly that scheduling is an in-app simulation.
export default function ScheduledPage() {
  const [agents, setAgents] = useState<ScheduledAgent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getScheduledAgents().then((result) => {
      if (!active) return;
      setLoaded(true);
      if (result.ok) setAgents(result.data);
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleToggle(id: string) {
    setAgents((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    );
    const result = await toggleAgent(id);
    if (result.ok) {
      const updated = result.data;
      setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } else {
      // Roll back on failure.
      setAgents((prev) =>
        prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
      );
      setError(result.error);
    }
  }

  const activeCount = agents.filter((a) => a.enabled).length;

  return (
    <PageShell
      kicker="SCHEDULED AGENTS"
      title="Monitoring Posture"
      statusLabel={loaded ? `${activeCount}/${agents.length} active` : "loading"}
      statusTone={activeCount > 0 ? "active" : "neutral"}
    >
      <div className="flex flex-col gap-5">
        <div className="mono flex items-center gap-2 rounded-lg border border-hairline bg-white/[.03] px-3.5 py-2.5 text-[12px] text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
          Scheduling is an in-app simulation. No external cron jobs run; toggling
          and next-run times are persisted and deterministic for the demo.
        </div>

        {error && <InlineError message={error} />}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggle={() => void handleToggle(agent.id)}
            />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function statusTone(status: string, enabled: boolean): StatusTone {
  if (!enabled) return "neutral";
  if (status === "running") return "warn";
  if (status === "alerted") return "critical";
  return "safe";
}

function readField(agent: ScheduledAgent, key: string): string {
  const value = agent[key];
  return typeof value === "string" && value.length > 0 ? value : "—";
}

interface AgentCardProps {
  agent: ScheduledAgent;
  onToggle: () => void;
}

function AgentCard({ agent, onToggle }: AgentCardProps) {
  const latestResult = readField(agent, "latest_result");
  const actionTaken = readField(agent, "action_taken");
  const lastRun = readField(agent, "last_run");
  const status = readField(agent, "status");

  return (
    <GlassPanel className="flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline bg-white/[.04]">
            <CalendarClock className="h-4 w-4 text-muted" strokeWidth={1.7} />
          </span>
          <div>
            <div className="text-[15px] font-semibold leading-tight tracking-tight text-ink">
              {agent.name}
            </div>
            <div className="mono mt-0.5 text-[11px] text-faint">
              {agent.schedule}
            </div>
          </div>
        </div>
        <ToggleSwitch
          enabled={agent.enabled}
          onToggle={onToggle}
          label={`Toggle ${agent.name}`}
        />
      </div>

      <dl className="flex flex-col gap-2 border-t border-hairline pt-3">
        <Row label="last run" value={formatTimestamp(lastRun)} />
        <Row label="next run" value={formatTimestamp(agent.next_run)} />
        <Row label="action taken" value={actionTaken} mono />
      </dl>

      <div>
        <div className="mono mb-1 text-[10.5px] uppercase tracking-[0.14em] text-faint">
          latest result
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted">{latestResult}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <StatusPill
          tone={statusTone(status, agent.enabled)}
          label={agent.enabled ? status : "paused"}
        />
        <span className="mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
          {agent.enabled ? "armed" : "disabled"}
        </span>
      </div>
    </GlassPanel>
  );
}

interface RowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function Row({ label, value, mono }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="mono text-[10.5px] uppercase tracking-[0.14em] text-faint">
        {label}
      </dt>
      <dd className={mono ? "mono text-[12px] text-ink/85" : "text-[12px] text-ink/85"}>
        {value}
      </dd>
    </div>
  );
}
