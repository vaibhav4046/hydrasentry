import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NoirBackground } from "@/components/noir/NoirBackground";
import { MotionProvider } from "@/components/noir/MotionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HydraSentry — Context Integrity for HydraDB Agents",
  description:
    "HydraSentry replays agent tasks against clean and poisoned HydraDB context, visualizes the graph path that caused failure, blocks unsafe memory through MCP, and exports evidence reports.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NoirBackground />
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
