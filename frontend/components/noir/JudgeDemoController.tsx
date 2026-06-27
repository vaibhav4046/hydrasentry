"use client";

/**
 * JudgeDemoController — the visible, stateful 6-stage Judge Demo state machine
 * that drives the homepage hero in place (no route change). It owns:
 *
 *   - the live STAGE (1..6: BASELINE → POISON → ATTACKED REPLAY → GRAPH →
 *     FIREWALL → CERTIFICATE), auto-advancing on dwell timers;
 *   - the ArtifactTreeGraph `stage` prop (0..100), so the graph composes and the
 *     tainted path lights up in lockstep with the narrative;
 *   - the hero metrics, which count up Risk 12 → 87 across the stages (never a
 *     jump) and flip Status SAFE → QUARANTINED;
 *   - the current agent answer line (baseline → poisoned → blocked);
 *   - a stage rail showing all six steps with the active one lit.
 *
 * REAL vs DETERMINISTIC. On start it fires the real backend judge demo
 * (runJudgeDemo, which has a bundled-demo fallback and never rejects) and
 * persists the resulting RunArtifact to the shared demo store so /results and
 * the certificate read the canonical artifact. The VISIBLE animation, however,
 * is driven by a DETERMINISTIC local timeline (lib/judgeDemoStages) so it always
 * looks dynamic and reaches the canonical 87 / HIGH / BLOCKED whether or not a
 * live backend answered. The backend never gates the show.
 *
 * Triggered two ways, both in place: the hero CTA1 here, and the header button
 * (which bumps `judgeRunNonce` in the store; this watches it). When a run is
 * already complete in the store on mount, the controller rests on the composed
 * final state (graph at 100, metrics at 87) rather than a cold zero.
 *
 * Reduced motion: with no sequence running the graph shows its composed state
 * and metrics rest at the baseline; once triggered, stages still advance (the
 * narrative is content, not decoration) but the count-up snaps per stage instead
 * of tweening. Nothing critical is ever hidden behind opacity:0.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { ArrowRight, Play, Loader2, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO, mastheadContainer, mastheadLine } from "@/lib/motion";
import { runJudgeDemo, runReal } from "@/lib/api";
import { useDemoStore } from "@/store/useDemoStore";
import { useCountUp } from "@/hooks/useCountUp";
import { useReducedMotionSafe } from "@/hooks/useReducedMotionSafe";
import type { RealRun } from "@/lib/types";
import { RealRunResult } from "./RealRunResult";
import {
  JUDGE_STAGES,
  JUDGE_STAGE_COUNT,
  IDLE_RISK,
  IDLE_STATUS,
} from "@/lib/judgeDemoStages";
import {
  ArtifactTreeGraph,
  ATG_STAGES,
} from "./ArtifactTreeGraph";
import { GraphPathInspector } from "./GraphPathInspector";

const KICKER = "HYDRADB NATIVE · MEMORY INTEGRITY · MCP FIREWALL";
const HEADLINE = "Secure the memory layer before your agent acts.";
const SUBCOPY =
  "HydraSentry replays clean and poisoned HydraDB context, traces the exact graph path behind unsafe behavior, blocks risky memory through MCP, and exports a Memory Integrity Certificate.";

const PRIMITIVE_CHIPS = [
  "HydraDB query_paths",
  "Memory Integrity Certificate",
  "MCP Firewall",
  "SkillMake Verifier",
  "Replay Harness",
  "Regression Rules",
  "Evidence Reports",
];

interface JudgeDemoControllerProps {
  /** Smooth-scroll target id for the certificate CTA (the anchor / panel). */
  certificateAnchorId: string;
}

export function JudgeDemoController({
  certificateAnchorId,
}: JudgeDemoControllerProps) {
  // -1 = idle (not started). 0..5 = active stage index. The completed run rests
  // on the final stage (5) once it finishes. If a completed run already exists
  // in the store on mount (deep link / reload), rest on the composed final state
  // instead of a cold zero — computed once via lazy initializers so no setState
  // runs inside an effect.
  const [stageIdx, setStageIdx] = useState<number>(() =>
    useDemoStore.getState().currentRun ? JUDGE_STAGES.length - 1 : -1,
  );
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState<boolean>(() =>
    Boolean(useDemoStore.getState().currentRun),
  );

  const setRun = useDemoStore((s) => s.setRun);
  const setStoreStage = useDemoStore((s) => s.setStage);
  const setStoreRunning = useDemoStore((s) => s.setRunning);
  const judgeRunNonce = useDemoStore((s) => s.judgeRunNonce);

  // T2: the REAL run is the product. The deterministic 6-stage strip is the
  // intro; the RESULT below it is the genuine /runs/real outcome (real Groq
  // answers + real computed score/band) — or, on backend error/overrun, the
  // honestly-labelled deterministic fallback. `realPending` gates the
  // "computing" affordance; `realRun` holds the resolved result.
  const [realRun, setRealRun] = useState<RealRun | null>(null);
  const [realPending, setRealPending] = useState(false);

  // T1: reduced-motion safety. Under prefers-reduced-motion the masthead must
  // render at its composed resting state — never behind the variants' hidden
  // `opacity:0` initial. We drop `initial="hidden"` and let the children sit at
  // their `show` values, so the headline/metrics/CTAs are guaranteed visible
  // (opacity 1) regardless of MotionConfig timing. Full motion is unchanged.
  const reduced = useReducedMotionSafe();
  const mastheadInitial = reduced ? false : ("hidden" as const);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedNonceRef = useRef<number>(judgeRunNonce);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  // Schedule the full 6-stage timeline from a clean start. Each stage advances
  // after the previous one's dwell. Deterministic and offline-safe.
  const playSequence = useCallback(() => {
    clearTimers();
    setComplete(false);
    setRunning(true);
    setStageIdx(0);

    let elapsed = 0;
    // `lastStageAt` is when the final stage (CERTIFICATE) lands; the run is
    // visually DONE at that instant, so the running flag must clear THEN (not on
    // a later cosmetic buffer) or the nav "Running…" label lags past stage 6.
    let lastStageAt = 0;
    for (let i = 0; i < JUDGE_STAGES.length; i += 1) {
      const dwell = JUDGE_STAGES[i].dwellMs;
      if (i > 0) {
        const at = elapsed;
        const idx = i;
        timersRef.current.push(
          setTimeout(() => setStageIdx(idx), at),
        );
        lastStageAt = at;
      }
      elapsed += dwell;
    }
    // Settle to done exactly when the final stage lights so the header button +
    // announcement strip resolve from "Running…" to idle/done at stage 6, with
    // no trailing lag.
    timersRef.current.push(
      setTimeout(() => {
        setRunning(false);
        setComplete(true);
      }, lastStageAt),
    );
  }, [clearTimers]);

  // The on-page run entry point: kick the deterministic intro animation
  // immediately, then do REAL work. Two backend calls fire in parallel:
  //  - runReal() is the product: a genuine /runs/real (live Groq + HydraDB,
  //    computed score). Its result is surfaced below the strip as the RESULT.
  //  - runJudgeDemo() still persists the canonical RunArtifact to the store so
  //    /results, the certificate, and the cockpit pages stay populated.
  // The visible deterministic strip never gates on either; the show always
  // plays. The real RESULT replaces nothing critical — it is additive.
  const start = useCallback(() => {
    if (running) return;
    playSequence();
    setStoreStage("running_judge_demo");
    setRealRun(null);
    setRealPending(true);
    void runReal().then((result) => {
      setRealPending(false);
      if (result.ok) setRealRun(result.data);
    });
    void runJudgeDemo().then((result) => {
      if (result.ok) setRun(result.data);
      setStoreStage("complete");
    });
  }, [running, playSequence, setRun, setStoreStage]);

  // Watch the store nonce so the header "Run Judge Demo" button triggers the
  // same in-place sequence. The initial mount value is ignored.
  useEffect(() => {
    if (judgeRunNonce === startedNonceRef.current) return;
    startedNonceRef.current = judgeRunNonce;
    start();
    // Bring the hero into view for the header trigger.
    if (typeof window !== "undefined") {
      const el = document.getElementById("hero");
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [judgeRunNonce, start]);

  // On unmount, clear timers AND release the shared "running" flag so a route
  // change mid-sequence can never leave the nav stuck on "Running…".
  useEffect(() => {
    return () => {
      clearTimers();
      setStoreRunning(false);
    };
  }, [clearTimers, setStoreRunning]);

  // Mirror the local running flag into the store so the header button label
  // ("Running…") stays accurate while the in-place sequence plays.
  useEffect(() => {
    setStoreRunning(running);
  }, [running, setStoreRunning]);

  const active = stageIdx >= 0 ? JUDGE_STAGES[stageIdx] : null;
  const idle = stageIdx < 0;

  // Resolve the graph stage + risk/status the metrics animate toward.
  const graphStage = active ? active.graphStage : ATG_STAGES.RETRIEVE;
  const targetRisk = active ? active.risk : IDLE_RISK;
  const status = active ? active.status : IDLE_STATUS;
  const answer = active?.answer ?? "Refunds above £500 require manager approval.";

  const risk = useCountUp(targetRisk, 950);
  const band = riskBand(risk);

  const reset = useCallback(() => {
    clearTimers();
    setRunning(false);
    setComplete(false);
    setStageIdx(-1);
  }, [clearTimers]);

  return (
    <section id="hero" className="relative scroll-mt-24 pb-12 pt-10 md:pt-14">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.96fr_1.04fr] lg:gap-10">
        {/* ============ LEFT: copy + CTAs + live console ============ */}
        <m.div
          className="relative z-20 flex flex-col items-start"
          variants={mastheadContainer}
          initial={mastheadInitial}
          animate="show"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-6 -inset-y-10 -z-10 lg:hidden"
            style={{
              background:
                "radial-gradient(120% 80% at 28% 38%, rgba(5,6,8,0.94), rgba(5,6,8,0.6) 55%, transparent 82%)",
            }}
          />

          <m.div variants={mastheadLine} className="mb-7 flex items-center gap-3.5">
            <span
              aria-hidden
              className="h-px w-7"
              style={{ background: "rgba(217,222,231,0.4)" }}
            />
            <span className="mono text-[10px] uppercase tracking-[0.26em] text-muted">
              {KICKER}
            </span>
          </m.div>

          <m.h1
            variants={mastheadLine}
            className="obs-display max-w-[16ch] text-balance text-[clamp(34px,4.6vw,60px)] font-semibold leading-[1.02] tracking-[-0.03em] text-ink"
          >
            {HEADLINE}
          </m.h1>

          <m.p
            variants={mastheadLine}
            className="mt-5 text-[clamp(15px,1.4vw,19px)] font-medium leading-snug text-ink"
          >
            Graph-native proof, not prompt vibes.
          </m.p>

          <m.p
            variants={mastheadLine}
            className="mt-3 max-w-[54ch] text-pretty text-[clamp(14px,1.15vw,16.5px)] leading-relaxed text-muted"
          >
            {SUBCOPY}
          </m.p>

          {/* CTAs */}
          <m.div
            variants={mastheadLine}
            className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
          >
            <button
              type="button"
              onClick={start}
              disabled={running}
              className={cn(
                "hydra-button-primary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold tracking-tight",
                "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.9} />
              ) : complete ? (
                <Check className="h-4 w-4" strokeWidth={1.9} />
              ) : (
                <Play className="h-4 w-4" strokeWidth={1.9} />
              )}
              {running
                ? "Running pipeline"
                : complete
                  ? "Run again"
                  : "Run Judge Demo"}
            </button>
            <a
              href={`#${certificateAnchorId}`}
              onClick={(e) => scrollToAnchor(e, certificateAnchorId)}
              className={cn(
                "hydra-button-secondary inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-semibold tracking-tight no-underline",
                "outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-base",
              )}
            >
              View Memory Certificate
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </a>
            {complete && (
              <button
                type="button"
                onClick={reset}
                className="mono inline-flex h-12 items-center justify-center gap-1.5 rounded-xl px-4 text-[12px] uppercase tracking-[0.14em] text-faint transition hover:text-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.7} />
                Reset
              </button>
            )}
          </m.div>

          {/* LIVE metric row: risk count-up + status + scanned counters */}
          <m.dl
            variants={mastheadLine}
            className="mt-11 grid w-full max-w-xl grid-cols-2 gap-x-8 gap-y-5 border-t border-hairline pt-6 sm:grid-cols-4 sm:gap-x-6"
          >
            <Metric
              label="Risk Score"
              value={`${risk}/100`}
              hot={risk >= 60}
            />
            <Metric label="Status" value={status} hot={!idle && active!.hot} />
            <Metric
              label="Risk Band"
              value={idle ? "LOW" : band}
              hot={!idle && band === "HIGH"}
            />
            <Metric
              label="Stage"
              value={idle ? "0 / 6" : `${active!.index} / ${JUDGE_STAGE_COUNT}`}
              hot={false}
            />
          </m.dl>

          {/* current agent behavior line */}
          <m.div
            variants={mastheadLine}
            className="mt-5 w-full max-w-xl rounded-xl border border-hairline bg-white/[0.015] px-4 py-3"
          >
            <div className="mono text-[9px] uppercase tracking-[0.2em] text-faint">
              {idle
                ? "Agent baseline answer"
                : active!.key === "BASELINE"
                  ? "Baseline answer · SAFE"
                  : active!.key === "POISON"
                    ? "Injected memory"
                    : active!.key === "CERTIFICATE"
                      ? "Certificate issued"
                      : "Agent answer"}
            </div>
            <p
              className={cn(
                "mt-1.5 text-[13.5px] leading-snug",
                !idle && active!.hot ? "text-ink" : "text-silver",
              )}
            >
              {answer}
            </p>
          </m.div>

          {/* Tainted-path read-out: appears once the path is traced (stage 4+),
              backing the graph picture with the exact labelled hop chain. */}
          {!idle && graphStage >= ATG_STAGES.RISK && (
            <m.div
              variants={mastheadLine}
              className="mt-4 w-full max-w-xl"
            >
              <GraphPathInspector derived />
            </m.div>
          )}
        </m.div>

        {/* ============ RIGHT: the dominant animated graph (stage-driven) ====== */}
        <m.div initial={false} animate={{ opacity: 1 }} className="relative z-10 w-full">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(circle at 52% 46%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 42%, transparent 70%)",
            }}
          />
          <div className="mx-auto aspect-[920/660] w-full max-w-[640px] lg:max-w-none">
            {/* When idle, omit the stage prop so the graph runs its living idle
                sweep; once a sequence is active, drive the exact stage. */}
            <ArtifactTreeGraph
              className="h-full w-full"
              stage={idle ? undefined : graphStage}
            />
          </div>

          {/* stage rail */}
          <StageRail activeKey={active?.key ?? null} running={running} />
        </m.div>
      </div>

      {/* ===== REAL RUN RESULT (T2): the genuine /runs/real outcome ===== */}
      {(realPending || realRun) && (
        <RealRunResult pending={realPending} result={realRun} reduced={reduced} />
      )}

      {/* primitive strip */}
      <m.ul
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.5 }}
        className="mx-auto mt-12 flex max-w-5xl flex-wrap items-center justify-center gap-x-1 gap-y-3 border-t border-hairline pt-7"
      >
        {PRIMITIVE_CHIPS.map((label, i) => (
          <li
            key={label}
            className="mono inline-flex items-center gap-x-5 text-[11.5px] tracking-wide"
          >
            {i > 0 && <span aria-hidden className="h-3 w-px bg-white/15" />}
            <span className="text-muted">{label}</span>
          </li>
        ))}
      </m.ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Metric({
  label,
  value,
  hot,
}: {
  label: string;
  value: string;
  hot: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dd
        className={cn(
          "cockpit-display text-[22px] font-semibold leading-none tabular-nums transition-colors",
          hot ? "text-ink" : "text-silver",
        )}
        style={hot ? { textShadow: "0 0 18px rgba(255,255,255,0.32)" } : undefined}
      >
        {value}
      </dd>
      <dt className="mono text-[9px] uppercase tracking-[0.16em] text-faint">
        {label}
      </dt>
    </div>
  );
}

/** The six-step rail beneath the graph; the active step is lit. */
function StageRail({
  activeKey,
  running,
}: {
  activeKey: string | null;
  running: boolean;
}) {
  return (
    <ol className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {JUDGE_STAGES.map((s) => {
        const isActive = activeKey === s.key;
        const reached =
          activeKey != null &&
          JUDGE_STAGES.findIndex((x) => x.key === activeKey) >= s.index - 1;
        return (
          <li
            key={s.key}
            data-active={isActive}
            className={cn(
              "flex flex-col gap-1 rounded-lg border px-2.5 py-2 transition-colors",
              isActive
                ? "border-white/55 bg-white/[0.06]"
                : reached
                  ? "border-white/15 bg-white/[0.02]"
                  : "border-hairline bg-transparent",
            )}
            style={
              isActive
                ? { boxShadow: "0 0 24px rgba(255,255,255,0.16)" }
                : undefined
            }
          >
            <span
              className={cn(
                "mono text-[8.5px] uppercase tracking-[0.12em]",
                isActive ? "text-ink" : reached ? "text-muted" : "text-faint",
              )}
            >
              {s.index} · {s.key}
              {running && isActive ? " ·" : ""}
            </span>
            <span
              className={cn(
                "text-[10.5px] leading-tight",
                isActive ? "text-silver" : "text-faint",
              )}
            >
              {s.title}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function riskBand(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  // The canonical run lands on HIGH at 87 (CLAUDE.md guardrail 5). The band
  // climbs LOW -> MEDIUM -> HIGH as the score walks 12 -> 87; CRITICAL is
  // reserved and never reached by this deterministic timeline.
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MEDIUM";
  return "LOW";
}

function scrollToAnchor(
  e: React.MouseEvent<HTMLAnchorElement>,
  id: string,
): void {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  if (history.replaceState) history.replaceState(null, "", `#${id}`);
}
