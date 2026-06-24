"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, AlertTriangle } from "lucide-react";
import { GlowButton, type GlowButtonSize } from "@/components/noir/GlowButton";
import { runJudgeDemo } from "@/lib/api";
import { useDemoStore } from "@/store/useDemoStore";
import { cn } from "@/lib/cn";

interface RunDemoButtonProps {
  label?: string;
  size?: GlowButtonSize;
  className?: string;
}

/**
 * Shared "Run Judge Demo" trigger. Calls the real backend client-side, stores
 * the resulting RunArtifact, and routes to /results on success. Shows an inline
 * running state and a compact error if the backend is unreachable. Used by both
 * the hero and the final CTA band; a compact variant powers the nav button.
 */
export function RunDemoButton({
  label = "Run Judge Demo",
  size = "lg",
  className,
}: RunDemoButtonProps) {
  const router = useRouter();
  const { isRunning, setRunning, setRun, setStage } = useDemoStore();
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    if (isRunning) return;
    setError(null);
    setRunning(true);
    setStage("running_judge_demo");
    const result = await runJudgeDemo();
    if (result.ok) {
      setRun(result.data);
      setStage("complete");
      setRunning(false);
      router.push("/results");
      return;
    }
    setRunning(false);
    setStage(null);
    setError(result.error);
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <GlowButton
        variant="primary"
        size={size}
        onClick={handleRun}
        disabled={isRunning}
        iconLeft={
          isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
          ) : (
            <Play className="h-4 w-4" strokeWidth={1.9} />
          )
        }
      >
        {isRunning ? "Running pipeline" : label}
      </GlowButton>
      {error && (
        <span className="mono inline-flex items-center gap-1.5 text-[11px] text-muted">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} />
          {error}. Is the backend running?
        </span>
      )}
    </div>
  );
}
