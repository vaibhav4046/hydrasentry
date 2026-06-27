/**
 * Monochrome band/decision styling for the console. Consistent with the noir
 * design system: danger/safe is brightness only (no hue). Higher band ->
 * brighter chip; blocking decision -> brighter.
 */
import { C } from "@/lib/cockpit/derive";

export function bandColor(band: string): string {
  switch ((band || "").toUpperCase()) {
    case "CRITICAL":
      return C.white;
    case "HIGH":
      return C.accent;
    case "MEDIUM":
      return C.silver;
    default:
      return C.muted;
  }
}

export function bandBorder(band: string): string {
  switch ((band || "").toUpperCase()) {
    case "CRITICAL":
      return "rgba(255,255,255,0.4)";
    case "HIGH":
      return "rgba(234,240,250,0.28)";
    default:
      return "rgba(255,255,255,0.12)";
  }
}

export function decisionIsBlocking(decision: string): boolean {
  return ["block", "quarantine", "require_human_review"].includes(
    (decision || "").toLowerCase(),
  );
}

/** Short relative-ish timestamp for the feed (UTC date + time). */
export function formatCreatedAt(iso: string | null): string {
  if (!iso) return "·";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}
