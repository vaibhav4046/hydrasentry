import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";

/**
 * Console route group layout. Wraps every /console/* surface in the AuthProvider
 * so the session, token, and tenant are available to the dashboard, API-keys
 * page, and incident detail. The public marketing/demo pages live outside this
 * group and never mount the provider.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
