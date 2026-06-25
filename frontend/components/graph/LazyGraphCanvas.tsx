"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { GraphCanvas as GraphCanvasType } from "./GraphCanvas";

/**
 * Code-split boundary for the React Flow map. `@xyflow/react` (~260KB of JS
 * plus its stylesheet) is the single heaviest dependency in the app and is only
 * ever needed once the user switches to the detailed "Graph view" on /graph —
 * which itself requires a real run. Loading it eagerly bloated the /graph route
 * bundle; this defers it (ssr:false so React Flow never runs on the server)
 * until the view is actually mounted. The CSS imports live inside GraphCanvas,
 * so they are split out with the chunk automatically.
 */
const GraphCanvas = dynamic(
  () => import("./GraphCanvas").then((m) => m.GraphCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-xl2 border border-hairline bg-deep/40">
        <span className="mono text-[11px] uppercase tracking-[0.18em] text-faint">
          Loading graph engine…
        </span>
      </div>
    ),
  },
);

export function LazyGraphCanvas(props: ComponentProps<typeof GraphCanvasType>) {
  return <GraphCanvas {...props} />;
}
