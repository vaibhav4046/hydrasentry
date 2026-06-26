/**
 * Global demo state for the judge run flow.
 *
 * The landing CTA and the dashboard pages share one in-flight run: when "Run
 * Judge Demo" succeeds it stores the RunArtifact here and routes to /results.
 * `stage` mirrors the backend pipeline stage label for any live progress UI.
 *
 * PERSISTENCE: the completed run is persisted to sessionStorage via zustand's
 * `persist` middleware so it survives a reload or a new tab in the same session.
 * This fixes the cold deep-link inconsistency where /results, /graph and
 * /mission disagreed after a run: once a run lands, every page reflects the SAME
 * run cross-tab. Only `currentRun` is persisted (the artifact); transient flags
 * (`isRunning`, `stage`) are not. sessionStorage (not localStorage) keeps the
 * demo session-scoped so a brand-new browser session starts clean/nominal.
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
  setRun: (run: RunArtifact | null) => void;
  setRunning: (isRunning: boolean) => void;
  setStage: (stage: string | null) => void;
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
      setRun: (run) => set({ currentRun: run }),
      setRunning: (isRunning) => set({ isRunning }),
      setStage: (stage) => set({ stage }),
      reset: () => set({ currentRun: null, isRunning: false, stage: null }),
    }),
    {
      name: STORAGE_KEY,
      // Session-scoped: a fresh browser session starts clean/nominal; reloads
      // and new tabs within the session see the same run.
      storage: createJSONStorage(() => sessionStorage),
      // Persist only the run artifact, never the transient in-flight flags.
      partialize: (state) => ({ currentRun: state.currentRun }),
      // Defer storage read to the client (avoids SSR hydration mismatch).
      skipHydration: true,
    },
  ),
);
