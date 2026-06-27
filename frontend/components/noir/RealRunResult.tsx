"use client";

/**
 * RealRunResult — the genuine RESULT of the primary "Run Judge Demo", surfaced
 * directly under the deterministic 6-stage intro strip on the homepage hero.
 *
 * The deterministic strip is the INTRO (it always plays and reaches the
 * canonical 87/HIGH). This panel is the real product OUTPUT: it renders the
 * actual /runs/real response — the real Groq baseline vs poisoned answers, the
 * real computed score + band (CRITICAL ~90 on a live run), the judge rationale,
 * and the live provider/model — behind an honest provenance label.
 *
 * HONESTY (mirrors backend/real_run.py + CLAUDE.md guardrail 2/5):
 *  - mode:"real"                  → "REAL RUN · live Groq agent + HydraDB,
 *                                    computed". This is the only state allowed
 *                                    to claim a real run.
 *  - mode:"deterministic_fallback"→ "OFFLINE · deterministic fallback" with the
 *                                    backend's fallback_reason. Never labelled
 *                                    real, never presented as live.
 *  - pending (no result yet)      → a "computing the real run" affordance.
 *
 * Monochrome only — no colour accents (design system).
 */
import { m } from "framer-motion";
import { Loader2, ShieldAlert, Activity } from "lucide-react";
import { cn } from "@/lib/cn";
import { EASE_OUT_EXPO } from "@/lib/motion";
import type { RealRun } from "@/lib/types";

interface RealRunResultProps {
  pending: boolean;
  result: RealRun | null;
  reduced: boolean;
}

export function RealRunResult({ pending, result, reduced }: RealRunResultProps) {
  const isReal = Boolean(result && result.real && result.mode === "real");
  // Show the computing affordance while the real call is in flight and no
  // result has resolved yet; once a result lands it takes over regardless of
  // the pending flag's trailing state.
  const showPending = pending && !result;
  const labelText = showPending
    ? "RUNNING THE REAL RUN · live Groq agent + HydraDB query"
    : isReal
      ? "REAL RUN · live Groq agent + HydraDB · computed"
      : "OFFLINE · deterministic fallback (real backend unavailable)";

  const initial = reduced ? false : { opacity: 0, y: 14 };

  return (
    <m.div
      initial={initial}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
      className="mx-auto mt-12 w-full max-w-5xl rounded-2xl border border-hairline bg-white/[0.015] p-5 sm:p-6"
    >
      {/* Provenance label — the one line that keeps the result honest. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex items-center gap-2.5">
          {showPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted" strokeWidth={1.9} />
          ) : isReal ? (
            <Activity className="h-4 w-4 text-ink" strokeWidth={1.9} />
          ) : (
            <ShieldAlert className="h-4 w-4 text-muted" strokeWidth={1.9} />
          )}
          <span
            className={cn(
              "mono text-[10px] uppercase tracking-[0.18em]",
              isReal ? "text-ink" : "text-muted",
            )}
          >
            {labelText}
          </span>
        </div>
        {result && (
          <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-faint">
            {result.llm_provider && result.llm_model
              ? `${result.llm_provider} · ${result.llm_model}`
              : "deterministic engine"}
          </span>
        )}
      </div>

      {!result ? (
        <p className="mono mt-4 text-[12px] leading-relaxed text-muted">
          {showPending
            ? "Querying both owned HydraDB sub-tenants (clean + poisoned), running the real agent on each context, and computing the risk score. This takes a few seconds; the result replaces nothing — it is the genuine outcome."
            : "The real run did not return a result."}
        </p>
      ) : (
        <>
          {/* Real computed score + band */}
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <ResultMetric
              label="Computed Risk"
              value={`${result.risk.score}/100`}
              hot={result.risk.score >= 60}
            />
            <ResultMetric
              label="Risk Band"
              value={result.risk.band}
              hot={result.risk.band === "HIGH" || result.risk.band === "CRITICAL"}
            />
            <ResultMetric
              label="Confidence"
              value={`${Math.round((result.risk.confidence ?? 0) * 100)}%`}
              hot={false}
            />
            <ResultMetric
              label="Score Basis"
              value={result.risk.computed ? "COMPUTED" : "DETERMINISTIC"}
              hot={false}
            />
          </div>

          {/* Real baseline vs poisoned answers (the genuine attack) */}
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnswerCard
              kind="baseline"
              heading={isReal ? "Baseline answer · clean context (real)" : "Baseline answer · clean context"}
              body={result.baseline_answer}
            />
            <AnswerCard
              kind="poisoned"
              heading={isReal ? "Poisoned answer · injected memory (real)" : "Poisoned answer · injected memory"}
              body={result.poisoned_answer}
            />
          </div>

          {/* Judge rationale, present only on a real run */}
          {isReal && result.risk.judge && (
            <div className="mt-5 rounded-xl border border-hairline bg-white/[0.02] px-4 py-3">
              <div className="mono text-[9px] uppercase tracking-[0.2em] text-faint">
                Real Groq judge · score {result.risk.judge.score}/100
              </div>
              <p className="mt-1.5 text-[13px] leading-snug text-silver">
                {result.risk.judge.rationale}
              </p>
            </div>
          )}

          {/* Honest fallback note when the real backend was unavailable */}
          {!isReal && (
            <p className="mono mt-5 text-[11px] leading-relaxed text-faint">
              The live backend did not complete a real run
              {result.fallback_reason ? ` (${result.fallback_reason})` : ""}, so
              this shows the deterministic canonical result. It is labelled
              honestly and is not a live agent answer.
            </p>
          )}
        </>
      )}
    </m.div>
  );
}

function ResultMetric({
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
          "cockpit-display text-[20px] font-semibold leading-none tabular-nums",
          hot ? "text-ink" : "text-silver",
        )}
        style={hot ? { textShadow: "0 0 16px rgba(255,255,255,0.3)" } : undefined}
      >
        {value}
      </dd>
      <dt className="mono text-[9px] uppercase tracking-[0.16em] text-faint">
        {label}
      </dt>
    </div>
  );
}

function AnswerCard({
  kind,
  heading,
  body,
}: {
  kind: "baseline" | "poisoned";
  heading: string;
  body: string;
}) {
  const poisoned = kind === "poisoned";
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3.5",
        poisoned
          ? "border-white/30 bg-white/[0.04]"
          : "border-hairline bg-white/[0.015]",
      )}
    >
      <div
        className={cn(
          "mono text-[9px] uppercase tracking-[0.18em]",
          poisoned ? "text-ink" : "text-faint",
        )}
      >
        {heading}
      </div>
      <p
        className={cn(
          "mt-2 text-[13px] leading-relaxed",
          poisoned ? "text-ink" : "text-silver",
        )}
      >
        {body}
      </p>
    </div>
  );
}
