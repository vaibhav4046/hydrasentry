import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MonochromeLogo } from "@/components/noir/MonochromeLogo";

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <MonochromeLogo variant="wordmark" height={26} />
        <div className="flex items-center gap-6">
          <Link
            href="#product"
            className="text-[13px] text-muted transition-colors hover:text-ink"
          >
            Product
          </Link>
          <Link
            href="#architecture"
            className="text-[13px] text-muted transition-colors hover:text-ink"
          >
            Architecture
          </Link>
          <Link
            href="/results"
            className="mono inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-ink"
          >
            Command center
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </Link>
        </div>
        <p className="mono text-[11px] text-faint">
          HydraSentry · Context Integrity Platform
        </p>
      </div>
    </footer>
  );
}
