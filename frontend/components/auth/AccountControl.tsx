"use client";

/**
 * Optional, non-blocking account control for the console top bar.
 *
 * NO LOGIN WALL: sign-in is never a gate in front of content — it is an OPTIONAL
 * affordance for seeing your OWN tenant. Signed in, this renders the UserMenu
 * (email chip + sign out). Signed out, it renders a quiet "Sign in" button that
 * opens the magic-link SignInCard in a dismissible modal. Either way the console
 * content behind it stays fully visible (every page shows the real demo tenant).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LogIn, X } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { UserMenu } from "./UserMenu";
import { SignInCard } from "./SignInCard";
import { C } from "@/lib/cockpit/derive";

export function AccountControl() {
  const { ready, configured, user } = useAuth();
  const [open, setOpen] = useState(false);

  // While the session is still resolving we render nothing rather than flash a
  // "Sign in" button at a user who is actually already signed in.
  if (configured && !ready) return null;
  if (user) return <UserMenu />;
  // If auth is not configured for this deployment there is nothing to sign into;
  // the demo tenant is the whole experience, so show no control.
  if (!configured) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 12px",
          borderRadius: 9,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.03)",
          color: C.silver,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 500,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(234,240,250,0.3)")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)")}
      >
        <LogIn size={14} strokeWidth={1.9} color={C.accent} />
        Sign in
      </button>
      {open && <SignInModal onClose={() => setOpen(false)} />}
    </>
  );
}

function SignInModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to your tenant"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 480 }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            zIndex: 2,
            display: "grid",
            placeItems: "center",
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(10,12,15,0.96)",
            color: C.faint,
            cursor: "pointer",
          }}
        >
          <X size={15} />
        </button>
        <SignInCard />
      </div>
    </div>,
    document.body,
  );
}
