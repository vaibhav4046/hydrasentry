"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { runJudgeDemo } from "@/lib/api";
import { useDemoStore } from "@/store/useDemoStore";

/**
 * Shared "Run Judge Demo" trigger for the homepage CTAs (announcement bar, nav,
 * hero, product canvas, final CTA). Mirrors the cockpit's run-demo flow exactly:
 * calls the real backend via runJudgeDemo() (bundled-demo fallback baked into
 * lib/api — it never rejects), stores the resulting RunArtifact, then routes
 * into the cockpit at /results. Returns { run, isRunning } so callers can show a
 * pending label without re-implementing the store wiring.
 */
export function useRunJudgeDemo() {
  const router = useRouter();
  const { isRunning, setRunning, setRun, setStage } = useDemoStore();

  const run = useCallback(async () => {
    if (isRunning) return;
    setRunning(true);
    setStage("running_judge_demo");
    const result = await runJudgeDemo();
    if (result.ok) setRun(result.data);
    setStage("complete");
    setRunning(false);
    router.push("/results");
  }, [isRunning, router, setRun, setRunning, setStage]);

  return { run, isRunning };
}
