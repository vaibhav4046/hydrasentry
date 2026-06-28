"use client";

/**
 * Honest tenant-provenance banner for the no-login-wall console surfaces.
 *
 * Every console page shows REAL data with zero login: signed out, that data is
 * the shared public DEMO tenant's real persisted rows (the backend resolves the
 * demo tenant for a token-less read); signed in, it is the caller's own tenant.
 * This banner states which it is, in plain words, and — when signed out — offers
 * an OPTIONAL "sign in to see your own" link. It never blocks content; it is a
 * label, not a wall (operating rule: no fabricated data, honest provenance).
 */
import Link from "next/link";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface TenantProvenanceBannerProps {
  /** True when a real Supabase user is signed in (own tenant). */
  isSignedIn: boolean;
  /** What this surface shows, e.g. "incidents" or "detection rules". */
  subject: string;
  /** Where the "sign in" link points (defaults to the keys page CTA). */
  signedOutHref?: string;
  /** Optional right-aligned slot (e.g. a refresh button). */
  action?: React.ReactNode;
}

export function TenantProvenanceBanner({
  isSignedIn,
  subject,
  signedOutHref = "/console/keys",
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
        border: `1px solid ${
          isSignedIn ? "rgba(234,240,250,0.18)" : "rgba(255,255,255,0.1)"
        }`,
        background: "rgba(255,255,255,0.018)",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
        {isSignedIn ? (
          <>
            Showing <span style={{ color: C.ink }}>your tenant&apos;s</span> real{" "}
            {subject}.
          </>
        ) : (
          <>
            Showing the <span style={{ color: C.ink }}>demo tenant&apos;s</span> real{" "}
            {subject} (read-only).{" "}
            <Link
              href={signedOutHref}
              style={{ color: C.accent, textDecoration: "underline" }}
            >
              Sign in
            </Link>{" "}
            to see and manage your own.
          </>
        )}
      </div>
      {action}
    </div>
  );
}
