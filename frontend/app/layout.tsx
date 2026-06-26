import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { NoirBackground } from "@/components/noir/NoirBackground";
import { MotionProvider } from "@/components/noir/MotionProvider";
import { DemoDataPill } from "@/components/shared/DemoDataPill";

// Constellan type system. Space Grotesk drives all body + cockpit UI (a sleek
// geometric grotesk); JetBrains Mono carries labels, IDs, badges, logs,
// query_paths and model ids. The hero masthead alone gets a distinctive display
// face: Instrument Serif (--font-display), a high-contrast editorial serif whose
// true italic powers the "...memory, and guard it." accent and whose name echoes
// the observatory instrument theme. Chosen over Fraunces (heavier, more generic),
// Bricolage (sans-on-sans, no contrast with the body) and Anton (loud all-caps,
// no italic). All self-hosted via next/font (no FOUT/CLS).
const spaceGrotesk = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Hero masthead display face only. Single 400 weight + true italic.
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
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
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NoirBackground />
        <MotionProvider>{children}</MotionProvider>
        <DemoDataPill variant="fixed" />
      </body>
    </html>
  );
}