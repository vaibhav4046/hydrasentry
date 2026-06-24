"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Play,
  Network,
  ScanLine,
  CalendarClock,
  Settings,
  Crosshair,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { MonochromeLogo } from "@/components/noir/MonochromeLogo";
import { cn } from "@/lib/cn";

export interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
}

interface AppNavProps {
  /** Override the default dashboard routes if needed. */
  items?: NavItem[];
  className?: string;
}

/**
 * Left icon rail for the dashboard surfaces. The next agent owns the eight
 * dashboard pages at these routes — adjust hrefs here if routes change. Active
 * route is detected via usePathname and lit brighter. Tooltips via title attr.
 */
export const DASHBOARD_NAV: NavItem[] = [
  { label: "Mission", href: "/mission", Icon: Crosshair },
  { label: "Replay", href: "/replay", Icon: Play },
  { label: "Graph", href: "/graph", Icon: Network },
  { label: "SkillMake", href: "/skillmake", Icon: ScanLine },
  { label: "MCP", href: "/mcp", Icon: ShieldCheck },
  { label: "Scheduled", href: "/scheduled", Icon: CalendarClock },
  { label: "Results", href: "/results", Icon: BarChart3 },
  { label: "Settings", href: "/settings", Icon: Settings },
];

export function AppNav({ items = DASHBOARD_NAV, className }: AppNavProps) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Dashboard navigation"
      className={cn(
        "flex h-full w-16 flex-col items-center gap-1 border-r border-hairline bg-deep/60 py-4 backdrop-blur-xl",
        className,
      )}
    >
      <Link
        href="/"
        aria-label="HydraSentry home"
        className="mb-3 grid place-items-center"
      >
        <MonochromeLogo variant="mark" height={30} />
      </Link>
      {items.map((item) => {
        const Icon = item.Icon;
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative grid h-11 w-11 place-items-center rounded-xl border transition",
              active
                ? "border-hairline-strong bg-white/[.08] text-ink"
                : "border-transparent text-faint hover:border-hairline hover:bg-white/[.04] hover:text-ink",
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.7} />
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-white" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
