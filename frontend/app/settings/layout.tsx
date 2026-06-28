import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";

/**
 * Settings route layout. Wraps the page in the AuthProvider so the writable
 * bring-your-own-key (BYO) provider config can read the signed-in session +
 * access token. Signed out, the page still renders (read-only platform status +
 * a sign-in CTA) -- the provider just reports no session.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
