"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { CockpitSidebar } from "./CockpitSidebar";
import { CockpitTopBar } from "./CockpitTopBar";
import { ROUTE_META } from "./cockpitNav";

interface CockpitShellProps {
  /** Override the resolved section label (defaults from the route). */
  section?: string;
  /** Override the resolved page title (defaults from the route). */
  title?: string;
  /** Optional extra top-bar actions, rendered left of Run Demo. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The Castellan Cockpit app shell: a fixed ~250px left command rail plus a top
 * bar and a scrolling main region. Applied to every dashboard route (via
 * PageShell) so the sidebar + top bar stay identical across surfaces. On mobile
 * the sidebar collapses into a slide-in drawer toggled from the top bar.
 *
 * Section/title resolve from the current route by default; pages may override.
 */
export function CockpitShell({
  section,
  title,
  actions,
  children,
}: CockpitShellProps) {
  const pathname = usePathname();
  // The drawer only closes via explicit user action: following a nav link
  // (CockpitSidebar onNavigate), tapping the scrim, or the close button. There
  // is no navigation path out of the drawer that those three don't cover, so no
  // route-change effect is needed.
  const [drawerOpen, setDrawerOpen] = useState(false);

  const meta = ROUTE_META[pathname] ?? findMeta(pathname);
  const resolvedSection = section ?? meta?.section ?? "Operations";
  const resolvedTitle = title ?? meta?.title ?? "Command";

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden shrink-0 lg:block">
        <CockpitSidebar />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <m.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <m.aside
              key="drawer"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <CockpitSidebar onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </m.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <CockpitTopBar
          section={resolvedSection}
          title={resolvedTitle}
          actions={actions}
          onMenu={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Resolve route meta for nested paths (e.g. /graph/abc -> /graph). */
function findMeta(pathname: string) {
  const base = Object.keys(ROUTE_META).find((href) =>
    pathname.startsWith(href),
  );
  return base ? ROUTE_META[base] : undefined;
}
