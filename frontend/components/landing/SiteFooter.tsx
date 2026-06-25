import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MonochromeLogo } from "@/components/noir/MonochromeLogo";

interface FooterCol {
  heading: string;
  links: { label: string; href: string }[];
}

const FOOTER_COLS: FooterCol[] = [
  {
    heading: "Product",
    links: [
      { label: "Overview", href: "#product" },
      { label: "Threat Model", href: "#use-cases" },
      { label: "Pipeline", href: "#pipeline" },
      { label: "Capabilities", href: "#features" },
    ],
  },
  {
    heading: "Platform",
    links: [
      { label: "Replay Lab", href: "/replay" },
      { label: "Graph Viewer", href: "/graph" },
      { label: "SkillMake", href: "/skillmake" },
      { label: "MCP Gateway", href: "/mcp" },
    ],
  },
  {
    heading: "Command Center",
    links: [
      { label: "Mission", href: "/mission" },
      { label: "Results", href: "/results" },
      { label: "Scheduled", href: "/scheduled" },
      { label: "Settings", href: "/settings" },
    ],
  },
];

/**
 * Premium multi-column footer. A brand column with the tagline sits beside three
 * navigation columns; a hairline-glow rule separates the legal strip. Monochrome
 * throughout — hover lifts links from muted to ink.
 */
export function SiteFooter() {
  return (
    <footer className="relative border-t border-hairline">
      {/* hairline glow accent on the top edge */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <MonochromeLogo variant="wordmark" height={28} />
            <p className="max-w-xs text-[13px] leading-relaxed text-muted">
              Context-integrity harness for memory-native agents. Replay,
              visualize, firewall, and report — HydraDB-native, fully
              deterministic.
            </p>
          </div>

          {FOOTER_COLS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h3 className="mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
                {col.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-[13px] text-muted transition-colors hover:text-ink"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center">
          <p className="mono text-[11px] text-faint">
            HydraSentry · Context Integrity Platform · HydraDB Build Blitz
          </p>
          <Link
            href="/results"
            className="mono inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
          >
            Open command center
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </footer>
  );
}
