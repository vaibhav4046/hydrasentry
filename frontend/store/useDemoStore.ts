/**
 * Global demo state for the judge run flow.
 *
 * The landing CTA and the dashboard pages share one in-flight run: when "Run
 * Judge Demo" succeeds it stores the RunArtifact here and routes to /results.
 * `stage` mirrors the backend pipeline stage label for any live progress UI.
 *
 * PERSISTENCE: the completed run is persisted to localStorage via zustand's
 * `persist` middleware so it survives a reload AND an independently-opened new
 * tab. This fixes the cold deep-link inconsistency that finding H2 calls out:
 * "a judge who runs the demo then opens /results in a new tab sees 0 risks next
 * to a graph screaming poison detected." sessionStorage is per-tab and would NOT
 * survive a fresh tab, so localStorage is required for the cross-tab case. On a
 * truly first visit (nothing stored) the cold state is still clean/nominal, so
 * "before any run -> all clean; after a run -> all show 87/HIGH" holds. Only
 * `currentRun` is persisted (the artifact); transient flags (`isRunning`,
 * `stage`) are not.
 *
 * Hydration is SSR-safe: `skipHydration` defers reading storage until the client
 * mounts (see RunStoreHydrator), so server and first client render both start
 * from the empty baseline and there is no hydration mismatch.
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { RunArtifact } from "@/lib/types";

export interface DemoState {
  currentRun: RunArtifact | null;
  isRunning: boolean;
  stage: string | null;
  /**
   * A monotonically-increasing nonce bumped each time an on-page "Run Judge
   * Demo" trigger fires (hero CTA, header button). The homepage JudgeDemo
   * controller watches this to start its visible in-place 6-stage sequence
   * without a route change. Transient (never persisted); zero is "no run yet".
   */
  judgeRunNonce: number;
  setRun: (run: RunArtifact | null) => void;
  setRunning: (isRunning: boolean) => void;
  setStage: (stage: string | null) => void;
  /** Bump the nonce to ask the on-page controller to play the sequence. */
  triggerJudgeRun: () => void;
  reset: () => void;
}

/** sessionStorage key for the persisted run artifact. */
const STORAGE_KEY = "constellan-demo-run";

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      currentRun: null,
      isRunning: false,
      stage: null,
      judgeRunNonce: 0,
      setRun: (run) => set({ currentRun: run }),
      setRunning: (isRunning) => set({ isRunning }),
      setStage: (stage) => set({ stage }),
      triggerJudgeRun: () =>
        set((s) => ({ judgeRunNonce: s.judgeRunNonce + 1 })),
      reset: () =>
        set({ currentRun: null, isRunning: false, stage: null }),
    }),
    {
      name: STORAGE_KEY,
      // localStorage so a run survives reload AND an independently-opened new
      // tab (the H2 cross-tab case). A first visit has nothing stored, so the
      // cold state is clean/nominal.
      storage: createJSONStorage(() => localStorage),
      // Persist only the run artifact, never the transient in-flight flags.
      partialize: (state) => ({ currentRun: state.currentRun }),
      // Defer storage read to the client (avoids SSR hydration mismatch).
      skipHydration: true,
    },
  ),
);
