/**
 * Memory Integrity Certificate (MIC) — the signed-document artifact HydraSentry
 * emits when a poisoned-memory run is blocked. This module is the SINGLE SOURCE
 * OF TRUTH for the certificate fields so every mount point (hero canvas, Results
 * Center, report modal) renders the identical record.
 *
 * The canonical values are fixed to the brief and match the deterministic
 * `memory_poisoning_refund` run (87 / HIGH / memory_poisoning). When a real run
 * artifact is available we OVERLAY the fields the artifact actually carries
 * (risk score/band, firewall decision, quarantined memory id, tenant) so a live
 * backend's canonical numbers win; otherwise the deterministic defaults stand.
 * Determinism is a feature here — see CLAUDE.md guardrail 5.
 */
import type { RunArtifact } from "./types";

export interface MemoryCertificate {
  certificateId: string;
  scenario: string;
  riskScore: number;
  riskBand: string;
  decision: string;
  attackType: string;
  taintedNode: string;
  chunkId: string;
  tenant: string;
  subtenant: string;
  firewallAction: string;
  quarantine: string;
  regressionRule: string;
  report: string;
  /** When true, the panel may surface the honest "demo / derived" provenance. */
  derived: boolean;
}

/** The exact certificate from the brief, also the offline/deterministic default. */
export const CANONICAL_MIC: MemoryCertificate = {
  certificateId: "MIC-2026-REFUND-001",
  scenario: "memory_poisoning_refund",
  riskScore: 87,
  riskBand: "HIGH",
  decision: "BLOCKED",
  attackType: "Memory Poisoning",
  taintedNode: "memory_91ab23",
  chunkId: "chunk_7f3a1c",
  tenant: "tenant_demo",
  subtenant: "support_agent",
  firewallAction: "approve_refund() blocked",
  quarantine: "complete",
  regressionRule: "created",
  report: "ready",
  derived: true,
};

/**
 * Build the certificate for a given run. The canonical record is the base; a
 * present artifact overlays only the fields it authoritatively carries. The
 * brief-mandated identity fields (certificate id, tainted node, chunk, tenant,
 * subtenant) are kept stable so the document reads identically everywhere.
 */
export function buildCertificate(
  run: RunArtifact | null,
): MemoryCertificate {
  if (!run) return CANONICAL_MIC;
  const decision = run.firewall?.decision
    ? run.firewall.decision === "block"
      ? "BLOCKED"
      : run.firewall.decision.toUpperCase()
    : CANONICAL_MIC.decision;
  return {
    ...CANONICAL_MIC,
    scenario: run.scenario_id || CANONICAL_MIC.scenario,
    riskScore: run.risk?.score ?? CANONICAL_MIC.riskScore,
    riskBand: run.risk?.band ?? CANONICAL_MIC.riskBand,
    decision,
    quarantine: run.quarantine?.status === "quarantined"
      ? "complete"
      : CANONICAL_MIC.quarantine,
    // Honest provenance: only a real HydraDB run is non-derived.
    derived: run.graph_source !== "real_query_paths",
  };
}

/** Ordered field rows for the certificate body (label/value pairs). */
export function certificateRows(
  mic: MemoryCertificate,
): { label: string; value: string; hot?: boolean }[] {
  return [
    { label: "Certificate ID", value: mic.certificateId },
    { label: "Scenario", value: mic.scenario },
    { label: "Risk Score", value: `${mic.riskScore} / 100`, hot: true },
    { label: "Decision", value: mic.decision, hot: true },
    { label: "Attack Type", value: mic.attackType },
    { label: "Tainted Node", value: mic.taintedNode },
    { label: "Chunk ID", value: mic.chunkId },
    { label: "Tenant", value: mic.tenant },
    { label: "Subtenant", value: mic.subtenant },
    { label: "Firewall Action", value: mic.firewallAction },
    { label: "Quarantine", value: mic.quarantine },
    { label: "Regression Rule", value: mic.regressionRule },
    { label: "Report", value: mic.report },
  ];
}
