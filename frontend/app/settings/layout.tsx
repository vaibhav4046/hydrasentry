import type { ReactNode } from "react";

/**
 * Settings route layout. The no-login bring-your-own-key config needs no auth
 * context: the key lives in this browser's localStorage and is read directly by
 * the page, so this layout is a passthrough.
 */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
