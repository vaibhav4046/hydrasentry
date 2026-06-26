import type { Metadata, Viewport } from "next";
import { Inter_Tight, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { NoirBackground } from "@/components/noir/NoirBackground";
import { MotionProvider } from "@/components/noir/MotionProvider";
import { DemoDataPill } from "@/components/shared/DemoDataPill";

// Castellan Cockpit type system: Inter Tight for body/UI, JetBrains Mono for
// labels, IDs, badges, logs, query_paths and model ids. Loaded via next/font
// (self-hosted, no FOUT/layout shift). The CSS variable names stay --font-geist-*
// so existing utility references in globals.css keep working; only the
// underlying font families change.
const interTight = Inter_Tight({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Display face for the Observatory homepage (/): Fraunces, a high-contrast
// literary "old-style" serif with real optical character (heavy stroke
// modulation, soft serifs). It is the deliberate anti-template move — an
// editorial star-atlas masthead instead of the generic Inter/Geist-bold AI
// headline. Loaded via next/font with `display: swap` (no FOUT/CLS) and exposed
// as --font-display; only the homepage references it, so the cockpit type system
// is untouched. `opsz` is pinned high for display sizing and we enable the
// `SOFT`/`WONK` axes lightly for warmth.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  // Variable font: omit `weight` (defaults to the full variable range) so the
  // optical-size axis and the SOFT/WONK axes can be requested. next/font only
  // permits `axes` when weight is absent or "variable".
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Constellan — Context Integrity for HydraDB Agents",
  description:
    "Constellan replays agent tasks against clean and poisoned HydraDB context, visualizes the graph path that caused failure, blocks unsafe memory through MCP, and exports evidence reports.",
  icons: {
    icon: [{ url: "/brand/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#050608",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${interTight.variable} ${jetbrainsMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NoirBackground />
        <MotionProvider>{children}</MotionProvider>
        <DemoDataPill variant="fixed" />
      </body>
    </html>
  );
}
