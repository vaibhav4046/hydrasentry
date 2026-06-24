import Image from "next/image";
import { cn } from "@/lib/cn";

interface MonochromeLogoProps {
  /** "mark" = glyph only; "wordmark" = glyph + HydraSentry lockup. */
  variant?: "mark" | "wordmark";
  className?: string;
  /** Pixel height; width scales to the SVG aspect ratio. */
  height?: number;
}

/**
 * Brand logo backed by the provided SVGs in /public/brand. Defaults to the
 * wordmark. The SVGs already embed a dark rounded tile, so they sit on any
 * background. Use `mark` for the icon rail / compact spots.
 */
export function MonochromeLogo({
  variant = "wordmark",
  className,
  height = 32,
}: MonochromeLogoProps) {
  if (variant === "mark") {
    return (
      <Image
        src="/brand/hydrasentry-mark.svg"
        alt="HydraSentry"
        width={height}
        height={height}
        className={cn("select-none", className)}
        priority
      />
    );
  }
  return (
    <Image
      src="/brand/hydrasentry-wordmark.svg"
      alt="HydraSentry"
      width={Math.round((720 / 128) * height)}
      height={height}
      className={cn("select-none", className)}
      priority
    />
  );
}
