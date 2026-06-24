"use client";

/**
 * Client hook that owns the "run the judge demo" action and its lifecycle.
 *
 * Wraps the demo store: exposes the current run, an in-flight flag, the last
 * error, and a `run()` that calls runJudgeDemo() and stores the artifact. Pages
 * that need a run (Graph, Results) use this to populate cold loads without
 * forcing a route change.
 */
import { useCallback, useState } from "react";
import { runJudgeDemo } from "@/lib/api";
import { useDemoStore } from "@/store/useDemoStore";
import type { RunArtifact } from "@/lib/types";

interface UseRunDemo {
  run: RunArtifact | null;
  isRunning: boolean;
  error: string | null;
  trigger: () => Promise<RunArtifact | null>;
}

export function useRunDemo(): UseRunDemo {
  const run = useDemoStore((s) => s.currentRun);
  const isRunning = useDemoStore((s) => s.isRunning);
  const setRun = useDemoStore((s) => s.setRun);
  const setRunning = useDemoStore((s) => s.setRunning);
  const setStage = useDemoStore((s) => s.setStage);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async (): Promise<RunArtifact | null> => {
    setError(null);
    setRunning(true);
    setStage("running_judge_demo");
    const result = await runJudgeDemo();
    setRunning(false);
    if (result.ok) {
      setRun(result.data);
      setStage("complete");
      return result.data;
    }
    setStage(null);
    setError(result.error);
    return null;
  }, [setRun, setRunning, setStage]);

  return { run, isRunning, error, trigger };
}
