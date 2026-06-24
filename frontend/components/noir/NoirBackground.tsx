"use client";

/**
 * Cinematic noir backdrop. Layers, bottom -> top:
 *   1. base void (#050608)
 *   2. the asset-pack memory-graph wallpaper (/bg/hero-noir-graph-4k.png),
 *      dimmed and radially masked so it is strongest behind the hero and
 *      fades to black toward the edges/bottom — this is the "wallpaper".
 *   3. a very slow GPU-only drift on that wallpaper layer (transform/opacity
 *      only, will-change: transform) for subtle life.
 *   4. a soft radial spotlight glow behind the upper-center hero.
 *   5. film grain (/bg/noir-noise.png), tiled, soft-light, very low opacity.
 *   6. a faint grid + a bottom->top vignette so foreground text and glass
 *      cards keep strong contrast on every page.
 *
 * Monochrome only (assets are already black/white). Purely decorative
 * (aria-hidden), fixed, full-bleed, -z-10, pointer-events-none. The drift is
 * the single moving part and is disabled under prefers-reduced-motion.
 * Mount once in the root layout behind everything.
 */
import { m, useReducedMotion } from "framer-motion";

export function NoirBackground() {
  const reduceMotion = useReducedMotion();

  // Radial mask: wallpaper strongest behind the upper-center hero, gone by the
  // edges/bottom so it never washes out foreground text on any page.
  const wallpaperMask =
    "radial-gradient(120% 95% at 50% 30%, #000 0%, #000 32%, rgba(0,0,0,0.55) 58%, transparent 82%)";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-base"
    >
      {/* 2 + 3: dimmed, radially-masked wallpaper with a very slow drift */}
      <m.div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url(/bg/hero-noir-graph-4k.png)",
          opacity: 0.32,
          maskImage: wallpaperMask,
          WebkitMaskImage: wallpaperMask,
          willChange: "transform",
        }}
        initial={false}
        animate={
          reduceMotion
            ? undefined
            : {
                transform: [
                  "translate3d(-1.2%, -0.8%, 0) scale(1.06)",
                  "translate3d(1.2%, 0.8%, 0) scale(1.1)",
                  "translate3d(-1.2%, -0.8%, 0) scale(1.06)",
                ],
              }
        }
        transition={{
          duration: 52,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* dark overlay to keep the wallpaper firmly in the 25-40% range */}
      <div className="absolute inset-0 bg-base/35" />

      {/* 4: soft radial spotlight behind the upper-center hero */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 32%, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 30%, transparent 56%)",
        }}
      />

      {/* 6a: faint grid, masked toward center, very low opacity */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage: "radial-gradient(circle at 50% 34%, #000, transparent 80%)",
          WebkitMaskImage:
            "radial-gradient(circle at 50% 34%, #000, transparent 80%)",
        }}
      />

      {/* 5: film grain — tiled, low opacity, soft-light blend */}
      <div
        className="absolute inset-0 opacity-[0.06] [mix-blend-mode:soft-light]"
        style={{
          backgroundImage: "url(/bg/noir-noise.png)",
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* 6b: bottom -> top vignette so foreground content keeps contrast */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-base via-base/70 to-transparent" />
      {/* edge vignette to seat the composition in the void */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: "inset 0 0 220px 60px rgba(5,6,8,0.9)",
        }}
      />
    </div>
  );
}
