"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { m } from "framer-motion";
import { ArrowRight, Database, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/cn";
import { fadeUp, staggerContainer, EASE_OUT_EXPO } from "@/lib/motion";
import { runJudgeDemo } from "@/lib/api";
import { useDemoStore } from "@/store/useDemoStore";
import { GlowButton } from "./GlowButton";
import { ArtifactTreeGraph } from "./ArtifactTreeGraph";
import { AnimatedRiskBadge } from "./AnimatedRiskBadge";
import { GraphKeyframeStrip } from "./GraphKeyframeStrip";
import {
  NodeInspectorPreview,
  type InspectorNode,
} from "./NodeInspectorPreview";
import { MAX_STAGE } from "./artifactTreeData";

// Hero copy (kept inline; mirrors the brief, monochrome product voice).
const KICKER = "HYDRADB NATIVE · CONTEXT INTEGRITY · MCP SECURITY";
const HEADLINE = "Secure the memory layer before your agent acts.";
const SUBCOPY =
  "HydraSentry poisons HydraDB context, replays agent tasks, visualizes the exact graph path that caused failure, blocks unsafe memory through MCP, and exports evidence reports.";

const PRIMITIVE_ROW = [
  "HydraDB query_paths",
  "MCP Gateway",
  "SkillMake Verifier",
  "Replay Harness",
  "Context Firewall",
  "Regression Rules",
  "Evidence Reports",
];

interface QueryPathRow {
  id: string;
  label: string;
  risky: boolean;
  score: number;
  hops: number;
  /** Tainted-tree badge this path highlights when selected. */
  badgeId: string;
}

const QUERY_PATHS: QueryPathRow[] = [
  { id: "p1", label: "Path 1 (Risky)", risky: true, score: 0.87, hops: 3, badgeId: "memory" },
  { id: "p2", label: "Path 2 (Safe)", risky: false, score: 0.42, hops: 2, badgeId: "policy" },
  { id: "p3", label: "Path 3 (Safe)", risky: false, score: 0.31, hops: 2, badgeId: "document" },
];

// While the demo runs, walk the tree through its 8 stages on this cadence.
const DEMO_STAGE_MS = 520;

/**
 * The signature HydraSentry hero. Cinematic split layout: copy + CTAs on the
 * left, the dominant ArtifactTreeGraph on the right/center (partially behind the
 * text but readable thanks to a legibility vignette), an interactive Query-Paths
 * preview card, the live AnimatedRiskBadge (12 -> 87), a graph_source badge, the
 * keyframe strip, and the primitive strip along the bottom.
 *
 * "Launch Interactive Demo" calls the real backend (runJudgeDemo) AND drives the
 * tree through stages 0 -> 7 as it plays, then routes to /results. Selecting the
 * risky path highlights the tainted branch; clicking a node opens the inspector.
 * Idle (no run) the tree autoplays + breathes. graph_source reflects the live
 * run when present, defaulting to DERIVED until a run exists.
 */
export function ArtifactTreeHero() {
  const router = useRouter();
  const { currentRun, isRunning, setRunning, setRun, setStage } =
    useDemoStore();

  const [selectedPath, setSelectedPath] = useState<string>("p1");
  const [inspectNode, setInspectNode] = useState<InspectorNode | null>(null);

  // Demo-driven stage. null => let the tree autoplay/idle-breathe.
  const [demoStage, setDemoStage] = useState<number | null>(null);
  // Keyframe strip mirrors whichever stage is showing (demo or a manual scrub).
  const [stripStage, setStripStage] = useState<number>(0);
  // Manual scrub overrides autoplay until a run starts.
  const [scrubStage, setScrubStage] = useState<number | null>(null);
  const stageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // graph_source badge: real query_paths vs derived scenario graph.
  const isRealGraph = currentRun?.graph_source === "real_query_paths";
  const graphSourceLabel = isRealGraph
    ? "REAL HYDRADB QUERY_PATHS"
    : "DERIVED SCENARIO GRAPH";

  const selectedRow = QUERY_PATHS.find((p) => p.id === selectedPath) ?? null;
  const selectedBadgeId = selectedRow?.risky ? selectedRow.badgeId : null;

  // Cleanup any running stage timer on unmount.
  useEffect(() => {
    return () => {
      if (stageTimer.current) clearTimeout(stageTimer.current);
    };
  }, []);

  // Drive the tree 0 -> MAX_STAGE while the demo runs, then route to results.
  const playStagesThenRoute = useCallback(() => {
    let current = 0;
    setDemoStage(0);
    setStripStage(0);
    const step = () => {
      if (current < MAX_STAGE) {
        current += 1;
        setDemoStage(current);
        setStripStage(current);
        stageTimer.current = setTimeout(step, DEMO_STAGE_MS);
      } else {
        // settle on the final frame briefly, then deep-link to results
        stageTimer.current = setTimeout(() => {
          router.push("/results");
        }, 650);
      }
    };
    stageTimer.current = setTimeout(step, DEMO_STAGE_MS);
  }, [router]);

  const handleLaunch = useCallback(async () => {
    if (isRunning) return;
    setScrubStage(null);
    setRunning(true);
    setStage("running_judge_demo");
    // Start the staged animation immediately so the visual reacts to the click.
    playStagesThenRoute();
    // runJudgeDemo() NEVER rejects: on any backend failure it returns the bundled
    // demo artifact (the canonical 87/HIGH run) wrapped as a success. So we ALWAYS
    // have a run to store and the staged animation + /results navigation always
    // play — there is no "Failed to fetch" path on this button in any environment.
    const result = await runJudgeDemo();
    if (result.ok) setRun(result.data);
    setStage("complete");
    setRunning(false);
  }, [isRunning, playStagesThenRoute, setRun, setRunning, setStage]);

  // Resolve the stage prop handed to the tree:
  // running demo -> demoStage; manual scrub -> scrubStage; else undefined (autoplay)
  const treeStage =
    demoStage != null ? demoStage : scrubStage != null ? scrubStage : undefined;
  const treeAutoplay = treeStage === undefined;

  // Keyframe strip reflects the showing stage; when autoplaying we can't know
  // the internal stage, so the strip tracks the last demo/scrub value.
  const handleScrub = useCallback((s: number) => {
    if (stageTimer.current) clearTimeout(stageTimer.current);
    setDemoStage(null);
    setScrubStage(s);
    setStripStage(s);
  }, []);

  const handleSelectPath = useCallback((id: string) => {
    setSelectedPath(id);
  }, []);

  return (
    <section
      id="product"
      className="relative mx-auto w-full max-w-7xl scroll-mt-24 px-6 pb-16 pt-12 md:pt-16 lg:pb-24"
    >
      <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
        {/* ============ LEFT: copy + CTAs ============ */}
        <m.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="relative z-20 flex flex-col items-start gap-6"
        >
          {/* legibility backing so text stays readable over the tree on small screens */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 lg:hidden"
            style={{
              background:
                "radial-gradient(120% 90% at 30% 40%, rgba(5,6,8,0.92), rgba(5,6,8,0.6) 55%, transparent 80%)",
            }}
          />
          <m.span
            variants={fadeUp}
            className="mono rounded-full border border-hairline bg-white/[.03] px-3.5 py-1.5 text-[11px] uppercase tracking-[0.18em] text-muted"
          >
            {KICKER}
          </m.span>
          <m.h1
            variants={fadeUp}
            className="text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-ink sm:text-5xl lg:text-[3.85rem]"
          >
            {HEADLINE}
          </m.h1>
          <m.p
            variants={fadeUp}
            className="max-w-xl text-pretty text-base leading-relaxed text-muted sm:text-[17px]"
          >
            {SUBCOPY}
          </m.p>
          <m.div
            variants={fadeUp}
            className="flex flex-col items-start gap-3 sm:flex-row sm:items-center"
          >
            <GlowButton
              variant="primary"
              size="lg"
              onClick={handleLaunch}
              disabled={isRunning}
              iconLeft={
                isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={1.9} />
                )
              }
            >
              {isRunning ? "Running pipeline" : "Launch Interactive Demo"}
            </GlowButton>
            <Link
              href="#pipeline"
              className={cn(
                "hydra-button-secondary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold tracking-tight",
                "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
              )}
            >
              See how it works
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </m.div>

          {/* interactive preview card */}
          <m.div variants={fadeUp} className="w-full max-w-md">
            <PreviewCard
              paths={QUERY_PATHS}
              selectedPath={selectedPath}
              onSelectPath={handleSelectPath}
              graphSourceLabel={graphSourceLabel}
              isRealGraph={isRealGraph}
            />
          </m.div>
        </m.div>

        {/* ============ RIGHT/CENTER: the dominant tree ============ */}
        <m.div
          initial={{ opacity: 0, filter: "blur(14px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
          className="relative z-10 w-full"
        >
          {/* soft halo so the luminous tree reads as the focal point */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 52% 40%, rgba(255,255,255,0.1), rgba(255,255,255,0.03) 40%, transparent 68%)",
            }}
          />
          <ArtifactTreeGraph
            stage={treeStage}
            autoplay={treeAutoplay}
            loop
            graph={currentRun?.graph ?? null}
            selectedPathId={selectedBadgeId}
            onNodeClick={setInspectNode}
            onPathSelect={handleSelectPath}
            className="mx-auto max-w-[680px] lg:max-w-none"
          />

          {/* node inspector slides in over the tree's right edge */}
          {inspectNode && (
            <div className="absolute right-0 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
              <NodeInspectorPreview
                node={inspectNode}
                onClose={() => setInspectNode(null)}
                onQuarantine={() => setInspectNode(null)}
              />
            </div>
          )}
        </m.div>
      </div>

      {/* keyframe strip under the composition */}
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.5 }}
        className="mx-auto mt-10 max-w-3xl"
      >
        <GraphKeyframeStrip activeStage={stripStage} onScrub={handleScrub} />
      </m.div>

      {/* primitive strip — hairline-divided mono row */}
      <m.ul
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.7 }}
        className="mx-auto mt-10 flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-hairline pt-6"
      >
        {PRIMITIVE_ROW.map((label, i) => (
          <li
            key={label}
            className="mono inline-flex items-center gap-5 text-[11.5px] tracking-wide text-faint"
          >
            {i > 0 && (
              <span aria-hidden className="h-3 w-px bg-white/15" />
            )}
            <span className="text-muted">{label}</span>
          </li>
        ))}
      </m.ul>
    </section>
  );
}

// ---- interactive preview card -----------------------------------------------
function PreviewCard({
  paths,
  selectedPath,
  onSelectPath,
  graphSourceLabel,
  isRealGraph,
}: {
  paths: QueryPathRow[];
  selectedPath: string;
  onSelectPath: (id: string) => void;
  graphSourceLabel: string;
  isRealGraph: boolean;
}) {
  return (
    <div className="hydra-glass rounded-xl2 flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-faint">
          Query paths
        </span>
        <span
          className={cn(
            "mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] uppercase tracking-[0.13em]",
            isRealGraph
              ? "border-white/45 bg-white/[.07] text-ink"
              : "border-hairline-strong bg-white/[.03] text-muted",
          )}
        >
          <Database className="h-3 w-3" strokeWidth={1.8} />
          {graphSourceLabel}
        </span>
      </div>

      {/* path list */}
      <ul className="flex flex-col gap-1.5">
        {paths.map((p) => {
          const active = p.id === selectedPath;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelectPath(p.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left outline-none transition-all duration-300",
                  active
                    ? p.risky
                      ? "border-white/60 bg-white/[.08] shadow-[0_0_18px_rgba(255,255,255,0.22)]"
                      : "border-white/40 bg-white/[.06]"
                    : "border-hairline bg-transparent hover:border-hairline-strong hover:bg-white/[.03]",
                  "focus-visible:ring-2 focus-visible:ring-white/70",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      p.risky && active
                        ? "bg-white shadow-[0_0_10px_rgba(255,255,255,0.85)]"
                        : active
                          ? "bg-white/70"
                          : "bg-white/30",
                    )}
                  />
                  <span
                    className={cn(
                      "mono text-[12px] tracking-tight",
                      active ? "text-ink" : "text-muted",
                    )}
                  >
                    {p.label}
                  </span>
                </span>
                <span className="mono text-[11px] tabular-nums text-faint">
                  {p.score.toFixed(2)} · {p.hops} hops
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* risk readout + attack type */}
      <div className="flex flex-col gap-3 border-t border-hairline pt-4">
        <AnimatedRiskBadge to={87} from={12} band="HIGH RISK" />
        <div className="flex items-center justify-between">
          <span className="mono text-[10.5px] uppercase tracking-[0.16em] text-faint">
            Attack type
          </span>
          <span className="mono text-[11.5px] tracking-tight text-ink">
            Memory Poisoning
          </span>
        </div>
      </div>
    </div>
  );
}
