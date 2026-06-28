"use client";

/**
 * Honest tenant-provenance banner for the no-login console surfaces.
 *
 * The product has no sign-in: every console page shows the shared public DEMO
 * tenant's REAL persisted rows (the backend resolves the demo tenant for a
 * token-less read) with zero login. This banner states that plainly. It never
 * blocks content; it is a label, not a wall (operating rule: no fabricated data,
 * honest provenance).
 */
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface TenantProvenanceBannerProps {
  /**
   * Retained for source compatibility; the product has no sign-in, so this is
   * effectively always false and the banner reads the same either way.
   */
  isSignedIn?: boolean;
  /** What this surface shows, e.g. "incidents" or "detection rules". */
  subject: string;
  /** Deprecated no-op (there is no sign-in link anymore). */
  signedOutHref?: string;
  /** Optional right-aligned slot (e.g. a refresh button). */
  action?: React.ReactNode;
}

export function TenantProvenanceBanner({
  subject,
  action,
}: TenantProvenanceBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        marginBottom: 16,
        padding: "11px 14px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.018)",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        Showing the <span style={{ color: C.ink }}>demo tenant&apos;s</span> real{" "}
        {subject} (read-only). Connect your agent to send your own incidents here.
      </div>
      {action}
    </div>
  );
}
