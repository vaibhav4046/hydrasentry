/**
 * Global demo state for the judge run flow.
 *
 * The landing CTA and the dashboard pages share one in-flight run: when "Run
 * Judge Demo" succeeds it stores the RunArtifact here and routes to /results.
 * `stage` mirrors the backend pipeline stage label for any live progress UI.
 */
import { create } from "zustand";
import type { RunArtifact } from "@/lib/types";

export interface DemoState {
  currentRun: RunArtifact | null;
  isRunning: boolean;
  stage: string | null;
  setRun: (run: RunArtifact | null) => void;
  setRunning: (isRunning: boolean) => void;
  setStage: (stage: string | null) => void;
  reset: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  currentRun: null,
  isRunning: false,
  stage: null,
  setRun: (run) => set({ currentRun: run }),
  setRunning: (isRunning) => set({ isRunning }),
  setStage: (stage) => set({ stage }),
  reset: () => set({ currentRun: null, isRunning: false, stage: null }),
}));
