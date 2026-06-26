"use client";

import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
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
 * Shared "Run Judge Demo" trigger. Calls the backend client-side, stores the
 * resulting RunArtifact, and routes to /results. runJudgeDemo() NEVER rejects
 * on any backend failure it returns the bundled canonical 87/HIGH demo artifact
 * wrapped as a success, so this button always plays the demo and navigates,
 * with no "Failed to fetch" path in any environment. Used by both the hero and
 * the final CTA band; a compact variant powers the nav button.
 */
export function RunDemoButton({
  label = "Run Judge Demo",
  size = "lg",
  className,
}: RunDemoButtonProps) {
  const router = useRouter();
  const { isRunning, setRunning, setRun, setStage } = useDemoStore();

  async function handleRun() {
    if (isRunning) return;
    setRunning(true);
    setStage("running_judge_demo");
    const result = await runJudgeDemo();
    if (result.ok) setRun(result.data);
    setStage("complete");
    setRunning(false);
    router.push("/results");
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
    </div>
  );
}
