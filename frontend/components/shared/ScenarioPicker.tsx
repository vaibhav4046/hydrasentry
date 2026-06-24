"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getScenarios } from "@/lib/api";
import type { ScenarioSummary } from "@/lib/types";
import { cn } from "@/lib/cn";

interface ScenarioPickerProps {
  value: string;
  onChange: (id: string, scenario: ScenarioSummary | undefined) => void;
  onLoaded?: (scenarios: ScenarioSummary[]) => void;
  className?: string;
}

/**
 * Native <select> styled to the noir system, populated from api.getScenarios().
 * Stays controlled by the parent; reports both the id and the full scenario on
 * change so callers can show its attack_type/objective. Handles fetch failure
 * by leaving the list empty (the page shows its own error state).
 */
export function ScenarioPicker({
  value,
  onChange,
  onLoaded,
  className,
}: ScenarioPickerProps) {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);

  useEffect(() => {
    let active = true;
    void getScenarios().then((result) => {
      if (!active || !result.ok) return;
      setScenarios(result.data);
      onLoaded?.(result.data);
    });
    return () => {
      active = false;
    };
  }, [onLoaded]);

  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => {
          const id = e.target.value;
          onChange(
            id,
            scenarios.find((s) => s.id === id),
          );
        }}
        aria-label="Scenario"
        className={cn(
          "mono w-full appearance-none rounded-xl border border-hairline-strong bg-white/[.04] py-2.5 pl-3.5 pr-10 text-[13px] text-ink",
          "outline-none focus-visible:ring-2 focus-visible:ring-white/70",
        )}
      >
        {scenarios.length === 0 && <option value="">Loading scenarios…</option>}
        {scenarios.map((scenario) => (
          <option key={scenario.id} value={scenario.id} className="bg-panel">
            {scenario.title}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        strokeWidth={1.8}
      />
    </div>
  );
}
