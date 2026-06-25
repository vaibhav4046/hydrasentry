"use client";

import type { ReactNode } from "react";
import { Menu, Search } from "lucide-react";
import { RunDemoButton } from "./RunDemoButton";
import { CockpitStatusPill } from "./CockpitStatusPill";
import { cn } from "@/lib/cn";

interface CockpitTopBarProps {
  /** Top-level section, e.g. "OPERATIONS". */
  section: string;
  /** Page title, e.g. "Command". */
  title: string;
  /** Optional extra page actions (rendered before the Run Demo button). */
  actions?: ReactNode;
  /** Opens the mobile sidebar drawer. */
  onMenu?: () => void;
  className?: string;
}

/**
 * Cockpit top bar: a breadcrumb (HYDRASENTRY / SECTION) over the page title on
 * the left, a centered command-search input, and a right cluster with a DEMO
 * pill, a risk-driven status pill, and the white Run Demo button. The search is
 * presentational (focuses, accepts text) — the cockpit's command palette hint.
 */
export function CockpitTopBar({
  section,
  title,
  actions,
  onMenu,
  className,
}: CockpitTopBarProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center gap-3 border-b border-hairline bg-deep/50 px-4 backdrop-blur-xl sm:px-6",
        className,
      )}
    >
      {/* Mobile: menu button */}
      <button
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-hairline text-muted transition hover:border-hairline-strong hover:text-ink lg:hidden"
      >
        <Menu className="h-4.5 w-4.5" strokeWidth={1.8} />
      </button>

      {/* Breadcrumb + title */}
      <div className="flex min-w-0 flex-col">
        <span className="mono truncate text-[10px] uppercase tracking-[0.2em] text-faint">
          HYDRASENTRY <span className="text-faint/60">/</span>{" "}
          {section.toUpperCase()}
        </span>
        <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
      </div>

      {/* Center search */}
      <div className="mx-auto hidden w-full max-w-md md:block">
        <label className="cockpit-search flex h-9 items-center gap-2 rounded-lg px-3">
          <Search className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.8} />
          <input
            type="text"
            placeholder="Search runs, skills, memories"
            aria-label="Search"
            className="mono w-full bg-transparent text-[12px] text-ink outline-none placeholder:text-faint"
          />
          <span className="cockpit-kbd shrink-0">⌘K</span>
        </label>
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2 md:ml-0">
        <span className="mono hidden items-center rounded-full border border-hairline-strong bg-white/[.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted sm:inline-flex">
          Demo
        </span>
        <CockpitStatusPill className="hidden sm:inline-flex" />
        {actions}
        <RunDemoButton />
      </div>
    </header>
  );
}
