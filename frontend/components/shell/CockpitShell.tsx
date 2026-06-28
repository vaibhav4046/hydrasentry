"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, m } from "framer-motion";
import { X } from "lucide-react";
import { CockpitSidebar } from "./CockpitSidebar";
import { CockpitTopBar } from "./CockpitTopBar";
import { CockpitAmbient } from "./CockpitAmbient";
import { ROUTE_META } from "./cockpitNav";
import { useDemoStore } from "@/store/useDemoStore";

interface CockpitShellProps {
  /** Override the resolved page title (defaults from the route). */
  title?: string;
  /** Optional extra top-bar actions, rendered left of the posture pill. */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * The Castellan Cockpit app shell: a `248px 1fr` grid, a sticky left command
 * rail plus a sticky top bar and a scrolling main region, over the exact
 * ambient radar/aurora/drift backdrop. Applied to every dashboard route via
 * PageShell so the chrome stays identical across surfaces. On mobile the sidebar
 * collapses into a slide-in drawer toggled from the top bar.
 *
 * Title + breadcrumb resolve from the current route (ROUTE_META). The sidebar's
 * SkillMake/Findings "1" badges light once a run is engaged in the shared store.
 */
export function CockpitShell({ title, actions, children }: CockpitShellProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const engaged = useDemoStore((s) => Boolean(s.currentRun));

  const meta = ROUTE_META[pathname] ?? findMeta(pathname);
  const resolvedTitle = title ?? meta?.title ?? "Command";
  const crumb = meta?.crumb ?? "HYDRASENTRY / OPERATIONS";

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "248px minmax(0, 1fr)",
        background: "transparent",
        width: "100%",
        maxWidth: "100vw",
        // `clip` (not `hidden`) contains the full-bleed ambient backdrop WITHOUT
        // establishing a scroll container on an ancestor of the sticky <aside>.
        // `overflow: hidden` makes the nearest scrollable ancestor the sticky
        // containing block, which silently breaks `position: sticky` on the rail
        // (the sidebar scrolls away). `clip` clips overflow with no scrollport,
        // so the rail stays pinned to the viewport on scroll across all routes.
        overflowX: "clip",
      }}
      className="cockpit-grid"
    >
      <CockpitAmbient />

      {/* Desktop sidebar (column 1). Hidden on mobile via CSS class. */}
      <div className="cockpit-rail">
        <CockpitSidebar engaged={engaged} />
      </div>

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
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              style={{ display: "block" }}
            />
            <m.div
              key="drawer"
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50"
            >
              <CockpitSidebar engaged={engaged} onNavigate={() => setDrawerOpen(false)} />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg border border-hairline text-muted hover:text-ink"
              >
                <X className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </m.div>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflowX: "clip",
        }}
      >
        <CockpitTopBar
          title={resolvedTitle}
          crumb={crumb}
          actions={actions}
          onMenu={() => setDrawerOpen(true)}
        />
        <div style={{ flex: 1, minWidth: 0, padding: 28, overflowX: "clip" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/** Resolve route meta for nested paths (e.g. /graph/abc -> /graph). */
function findMeta(pathname: string) {
  const base = Object.keys(ROUTE_META).find((href) => pathname.startsWith(href));
  return base ? ROUTE_META[base] : undefined;
}
