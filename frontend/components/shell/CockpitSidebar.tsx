"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { COCKPIT_NAV } from "./cockpitNav";
import { BUILD_SHORT } from "@/lib/build";
import { cn } from "@/lib/cn";

interface CockpitSidebarProps {
  /** Called after a nav link is followed (used to close the mobile drawer). */
  onNavigate?: () => void;
  className?: string;
}

/**
 * The fixed left command rail. Wordmark, a workspace selector card, grouped nav
 * with tiny uppercase section labels + active filled pills + count badges, and a
 * systems-nominal footer with mono meta lines. Monochrome throughout.
 */
export function CockpitSidebar({ onNavigate, className }: CockpitSidebarProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex h-full w-[250px] flex-col border-r border-hairline bg-deep/70 backdrop-blur-xl",
        className,
      )}
    >
      {/* Wordmark */}
      <div className="flex items-center gap-2 px-5 pb-4 pt-5">
        <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
        <span className="mono text-[12.5px] font-semibold uppercase tracking-[0.2em] text-ink">
          Hydrasentry
        </span>
        <span className="mono text-[13px] text-faint">·</span>
      </div>

      {/* Workspace selector */}
      <div className="px-3">
        <button
          type="button"
          className="cockpit-card cockpit-card-hover flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-hairline-strong bg-white/[.06] text-[13px] font-semibold text-ink">
            R
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold tracking-tight text-ink">
              Refund Agent
            </span>
            <span className="mono block truncate text-[10px] uppercase tracking-[0.14em] text-faint">
              workspace · prod
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.8} />
        </button>
      </div>

      {/* Grouped nav */}
      <nav
        aria-label="Cockpit navigation"
        className="mt-5 flex-1 overflow-y-auto px-3 pb-4"
      >
        {COCKPIT_NAV.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="cockpit-eyebrow px-2 pb-2">{group.label}</div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.Icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    data-active={active}
                    aria-current={active ? "page" : undefined}
                    className="cockpit-nav-item"
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.7} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={cn(
                          "mono rounded-md px-1.5 py-0.5 text-[10px] tabular-nums",
                          active
                            ? "bg-white/[.12] text-ink"
                            : "bg-white/[.05] text-faint",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer: systems nominal + meta */}
      <div className="border-t border-hairline px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          <span className="text-[12px] font-medium tracking-tight text-ink">
            All systems nominal
          </span>
        </div>
        <div className="mono mt-2.5 space-y-1 text-[10px] leading-relaxed text-faint">
          <div>demo · region lhr1 · build {BUILD_SHORT}</div>
          <div>tenant owned · sub hydrasentry-demo</div>
        </div>
      </div>
    </div>
  );
}
