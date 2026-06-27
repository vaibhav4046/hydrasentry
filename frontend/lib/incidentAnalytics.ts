/**
 * Pure analytics over a list of persisted incidents. No network, no mutation —
 * computed during render from the REAL /incidents data. Empty input yields a
 * clean zero-state (never fabricated counts).
 */
import type { Incident } from "./consoleTypes";

const BLOCKING_DECISIONS = new Set(["block", "quarantine", "require_human_review"]);
const CRITICAL_BANDS = new Set(["HIGH", "CRITICAL"]);

export interface IncidentAnalytics {
  total: number;
  blocked: number;
  criticals: number;
  avgScore: number;
  topAttackTypes: { type: string; count: number }[];
  /** Incidents per UTC day, oldest -> newest, for the sparkline. */
  perDay: { day: string; count: number; criticals: number }[];
}

function isBlocked(inc: Incident): boolean {
  return BLOCKING_DECISIONS.has((inc.decision || "").toLowerCase());
}

function isCritical(inc: Incident): boolean {
  return CRITICAL_BANDS.has((inc.band || "").toUpperCase());
}

export function computeAnalytics(incidents: Incident[]): IncidentAnalytics {
  const total = incidents.length;
  if (total === 0) {
    return { total: 0, blocked: 0, criticals: 0, avgScore: 0, topAttackTypes: [], perDay: [] };
  }

  let blocked = 0;
  let criticals = 0;
  let scoreSum = 0;
  const attackCounts = new Map<string, number>();
  const dayCounts = new Map<string, { count: number; criticals: number }>();

  for (const inc of incidents) {
    if (isBlocked(inc)) blocked += 1;
    const crit = isCritical(inc);
    if (crit) criticals += 1;
    scoreSum += inc.risk_score || 0;

    const attack = inc.attack_type || "unknown";
    attackCounts.set(attack, (attackCounts.get(attack) ?? 0) + 1);

    const day = inc.created_at ? inc.created_at.slice(0, 10) : "unknown";
    const prev = dayCounts.get(day) ?? { count: 0, criticals: 0 };
    dayCounts.set(day, { count: prev.count + 1, criticals: prev.criticals + (crit ? 1 : 0) });
  }

  const topAttackTypes = Array.from(attackCounts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const perDay = Array.from(dayCounts.entries())
    .filter(([day]) => day !== "unknown")
    .map(([day, v]) => ({ day, count: v.count, criticals: v.criticals }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return {
    total,
    blocked,
    criticals,
    avgScore: Math.round(scoreSum / total),
    topAttackTypes,
    perDay,
  };
}
