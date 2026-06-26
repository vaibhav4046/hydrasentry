import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NoirBackground } from "@/components/noir/NoirBackground";
import { MotionProvider } from "@/components/noir/MotionProvider";
import { DemoDataPill } from "@/components/shared/DemoDataPill";

// Constellan type system — a deliberate, harmonious three-part mix (no serif):
//   DISPLAY  Space Grotesk (--font-display): a sleek geometric grotesk with real
//            character (single-story a, angular t, distinctive g). Drives the
//            hero masthead AND the major cockpit titles + big-number metrics so
//            the homepage and the cockpit read as one system. Its technical
//            geometry echoes the cartographic / instrument star-atlas brand.
//   TEXT     Inter (--font-geist-sans): the neutral, highly-legible workhorse for
//            body copy, UI chrome, captions and nav. Deliberately plainer than the
//            display so the pairing reads intentional (character vs neutral).
//   MONO     JetBrains Mono (--font-geist-mono): labels, IDs, query_paths, logs,
//            badges, coordinates, keycaps.
// Display chosen over Sora/Outfit (cleaner but generic) and Bricolage (quirkier,
// competes with the mono). Text uses Inter over Inter Tight for steadier
// legibility at 10-13px cockpit sizes. All self-hosted via next/font (no FOUT/CLS).
const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Constellan, Context Integrity for HydraDB Agents",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NoirBackground />
        <MotionProvider>{children}</MotionProvider>
        <DemoDataPill variant="fixed" />
      </body>
    </html>
  );
}