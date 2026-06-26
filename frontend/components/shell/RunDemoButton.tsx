"use client";

import { Loader2, Play } from "lucide-react";
import { useRunDemo } from "@/hooks/useRunDemo";
import { cn } from "@/lib/cn";

/**
 * Top-bar "Run Demo" action. Triggers the REAL judge-demo run through the shared
 * demo store (lib/api.runJudgeDemo, with bundled-fixture fallback). The resulting
 * artifact populates every page that reads useRunDemo / the store (Command,
 * Graph, Replay, Results) without a route change. White/silver pill, the one
 * bright affordance in the chrome.
 */
export function RunDemoButton({ className }: { className?: string }) {
  const { isRunning, trigger } = useRunDemo();
  return (
    <button
      type="button"
      onClick={() => void trigger()}
      disabled={isRunning}
      className={cn(
        "hydra-button-primary inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold tracking-tight",
        "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {isRunning ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.9} />
      ) : (
        <Play className="h-3.5 w-3.5" strokeWidth={2} />
      )}
      {isRunning ? "Running" : "Run Demo"}
    </button>
  );
}
