"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MonochromeLogo } from "@/components/noir/MonochromeLogo";
import { cn } from "@/lib/cn";
import { NAV_LINKS } from "./content";
import { RunDemoButton } from "./HeroActions";

/**
 * Landing-only chrome: a thin announcement bar plus a sticky nav that gains a
 * glass background once the page scrolls. Distinct from the dashboard AppNav
 * rail. The "Launch Demo" button reuses the shared run-demo flow.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sticky top-0 z-30">
      <div className="border-b border-hairline bg-deep/80 backdrop-blur-xl">
        <p className="mono mx-auto max-w-7xl px-6 py-2 text-center text-[11px] tracking-[0.08em] text-muted">
          HydraSentry scans HydraDB query_paths, SkillMake skills, and MCP
          context before agents act.
        </p>
      </div>
      <nav
        className={cn(
          "border-b transition-colors duration-300",
          scrolled
            ? "border-hairline bg-base/80 backdrop-blur-xl"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-3">
          <Link href="/" aria-label="HydraSentry home" className="shrink-0">
            <MonochromeLogo variant="wordmark" height={30} />
          </Link>
          <div className="hidden items-center gap-7 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[13px] font-medium text-muted transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <RunDemoButton label="Launch Demo" size="sm" />
        </div>
      </nav>
    </div>
  );
}
