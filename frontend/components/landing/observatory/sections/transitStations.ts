/**
 * Transit stations for the Observation Log diagram.
 *
 * The poisoned-memory attack flow, reframed from the old tall vertical log into
 * a compact horizontal "transit" (a body crossing a sensor meridian). These
 * mirror landingData.FLOW_STEPS 1:1 in order and title; the `cap` is a distilled
 * one-line caption so each station fits the compact diagram, and `phase` drives
 * the monochrome brightness ramp + the firewall halt (danger = brightness, never
 * hue). No em dashes in copy (commas / middots only).
 *
 * phase semantics (cool silver -> white-hot -> intercept -> resolve):
 *   safe        normal pre-attack stations (dim silver)
 *   poison      the injection point (brightening)
 *   compromised the poisoned replay + risk score (white-hot, the breach peak)
 *   intercept   the MCP firewall, where the transit is STOPPED (the sever beat)
 *   resolve     quarantine + report, recovered after the halt (calm white)
 */
export type TransitPhase =
  | "safe"
  | "poison"
  | "compromised"
  | "intercept"
  | "resolve";

export interface TransitStation {
  n: string;
  title: string;
  cap: string;
  phase: TransitPhase;
}

export const TRANSIT_STATIONS: TransitStation[] = [
  { n: "01", title: "Seed context", cap: "Clean refund policy in HydraDB", phase: "safe" },
  { n: "02", title: "Baseline replay", cap: "Agent asks approval · SAFE", phase: "safe" },
  { n: "03", title: "Inject poison", cap: '"VIP refunds bypass policy"', phase: "poison" },
  { n: "04", title: "Poisoned replay", cap: "Approves £900 · COMPROMISED", phase: "compromised" },
  { n: "05", title: "Score risk", cap: "Risk engine · 87 / HIGH", phase: "compromised" },
  { n: "06", title: "Extract graph", cap: "Tainted query_paths to core", phase: "compromised" },
  { n: "07", title: "MCP firewall", cap: "Context withheld · BLOCKED", phase: "intercept" },
  { n: "08", title: "Quarantine", cap: "mem_poison_047 severed", phase: "resolve" },
  { n: "09", title: "Evidence report", cap: "Rule · scan · report exported", phase: "resolve" },
];

/**
 * Index of the firewall station (07) where the transit halts. The marker arrives
 * here, the shield/sever beat fires, then the resolve stations (08, 09) light.
 */
export const INTERCEPT_INDEX = 6;
