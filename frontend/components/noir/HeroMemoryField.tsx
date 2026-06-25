"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { usePauseOffscreen } from "@/hooks/usePauseOffscreen";
import { usePointerField } from "@/hooks/usePointerField";
import { WebGLMemoryFieldPoster } from "./WebGLMemoryFieldPoster";
import { anchorIndexFor } from "./heroAnchors";

/**
 * Landing-hero background field controller. This is the ONE integration surface
 * the hero imports; it keeps the heavy WebGL renderer OUT of the first-load
 * bundle and degrades gracefully.
 *
 *  • CODE-SPLIT: the WebGL2 renderer (shaders, geometry baker, GL plumbing) is
 *    pulled via next/dynamic({ ssr:false }) so it never blocks first paint nor
 *    bloats the shared chunk. The crisp monochrome <WebGLMemoryFieldPoster/> is
 *    the `loading` placeholder, so the hero shows the tree silhouette instantly.
 *  • FALLBACKS: prefers-reduced-motion → poster only (no GL, no motion). No
 *    WebGL2 support (feature-detected client-side) → poster only. Never blank,
 *    never an error.
 *  • OWNS the pointer-field spring + offscreen-pause hooks and forwards them to
 *    the renderer. Maps the hovered node id → anchor index, and `isRunning`
 *    (the Launch Demo run) → a core-energy pulse.
 *
 * Public surface is deliberately small and stable; the hero passes demo stage,
 * hovered node id, and whether a run is in progress.
 */
const WebGLMemoryField = dynamic(
  () => import("./WebGLMemoryField").then((m) => m.WebGLMemoryField),
  {
    ssr: false,
    loading: () => <WebGLMemoryFieldPoster />,
  },
);

interface HeroMemoryFieldProps {
  /** Active demo stage 0..7 (undefined => idle, all branches shown). */
  stage?: number;
  /** Hovered node id (lights that node's filament). */
  hoveredNodeId?: string | null;
  /** A Launch-Demo run is in progress → core/tainted energy pulse. */
  isRunning?: boolean;
  className?: string;
}

/** Feature-detect WebGL2. SSR returns null (no `document`); the first CLIENT
 *  render resolves it synchronously via a lazy initializer — no effect, no
 *  cascading re-render. The poster covers the SSR/null window either way. This
 *  is a one-shot capability probe of an external system (the GPU), exactly the
 *  kind of read a lazy useState initializer is meant for. */
function useWebGL2Supported(): boolean | null {
  const [ok] = useState<boolean | null>(() => {
    if (typeof document === "undefined") return null;
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch {
      return false;
    }
  });
  return ok;
}

export function HeroMemoryField({
  stage,
  hoveredNodeId = null,
  isRunning = false,
  className,
}: HeroMemoryFieldProps) {
  const prefersReduced = useReducedMotion();
  const webglOk = useWebGL2Supported();

  // Offscreen / tab-hidden pause (renderer reads host data-anim) + smoothed
  // pointer spring. Both attach to the SAME host via a merged ref.
  const pauseRef = usePauseOffscreen<HTMLDivElement>("220px 0px");
  const { hostRef: pointerHostRef, field: pointerField } =
    usePointerField<HTMLDivElement>();
  const setHostRef = useMemo(
    () => (el: HTMLDivElement | null) => {
      pauseRef.current = el;
      pointerHostRef.current = el;
    },
    [pauseRef, pointerHostRef],
  );

  const hoveredAnchor = useMemo(
    () => anchorIndexFor(hoveredNodeId),
    [hoveredNodeId],
  );

  // Gentle core-energy pulse while a run plays (drives uCorePulse in the shader).
  const corePulse = isRunning ? 1 : 0;

  // Reduced-motion OR no WebGL → static poster only (never mount the GL canvas).
  const useStaticPoster = prefersReduced || webglOk === false;

  return (
    <div
      ref={setHostRef}
      className={cn("relative w-full select-none", className)}
      aria-hidden="true"
    >
      {useStaticPoster ? (
        <WebGLMemoryFieldPoster />
      ) : (
        <WebGLMemoryField
          stage={stage}
          staticFrame={!!prefersReduced}
          pointer={pointerField}
          hoveredAnchor={hoveredAnchor}
          corePulse={corePulse}
        />
      )}
    </div>
  );
}

export default HeroMemoryField;
