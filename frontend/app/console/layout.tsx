import type { ReactNode } from "react";

/**
 * Console route group layout. The product has no sign-in, so the console needs
 * no auth context: every /console/* surface is public and reads the shared demo
 * tenant's real rows token-less. This layout is a passthrough.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
