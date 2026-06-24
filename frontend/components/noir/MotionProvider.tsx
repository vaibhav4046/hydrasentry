"use client";

/**
 * Wraps the app in Framer Motion's LazyMotion (loads the DOM feature bundle
 * once) and a MotionConfig that flips to reduced motion when the OS requests
 * it. All `motion.*` usages elsewhere inherit this. Keep this near the root in
 * app/layout.tsx, inside <body>.
 */
import { LazyMotion, MotionConfig, domAnimation } from "framer-motion";
import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

interface MotionProviderProps {
  children: ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  const prefersReduced = useReducedMotion();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={prefersReduced ? "always" : "never"}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
