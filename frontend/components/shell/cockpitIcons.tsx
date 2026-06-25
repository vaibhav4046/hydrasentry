/**
 * Castellan Cockpit icon set — the EXACT inline SVG path data from the source's
 * ICON map, rendered as a tiny stroked-path component. Using the source's own
 * path data (rather than a lucide approximation) keeps the glyphs pixel-identical
 * to the standalone. 24x24 viewBox, round caps/joins, stroke width 1.6 to match.
 */

export type CockpitIconKey =
  | "mission"
  | "replay"
  | "graph"
  | "skill"
  | "mcp"
  | "scheduled"
  | "results"
  | "settings";

const ICON_D: Record<CockpitIconKey, string> = {
  mission:
    "M12 3a9 9 0 100 18 9 9 0 000-18M12 8a4 4 0 100 8 4 4 0 000-8M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3",
  replay: "M3.6 12a8.4 8.4 0 108.4-8.4A8.4 8.4 0 005.6 6.1M3.6 2.6v3.8h3.8",
  graph:
    "M6 6.4a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4M6 22a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4M19.8 12a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4M7.9 5.6l9 4.6M7.9 18.4l9-4.6",
  skill: "M12 2.5l8 3v6c0 5-3.4 8.5-8 9.9-4.6-1.4-8-4.9-8-9.9v-6zM8.6 12l2.3 2.3L16 9",
  mcp: "M3.5 4.5h17v5h-17zM3.5 14h17v5h-17zM7 7h.02M7 16.5h.02",
  scheduled: "M12 3a9 9 0 100 18 9 9 0 000-18M12 7.2v5l3.2 2",
  results: "M4 20.5V10M10 20.5V4M16 20.5v-8M22 20.5H2",
  settings: "M3.5 7h17M3.5 12h17M3.5 17h17M8.5 5v4M16 10v4M11.5 15v4",
};

interface CockpitIconProps {
  name: CockpitIconKey;
  color: string;
  size?: number;
}

export function CockpitIcon({ name, color, size = 16 }: CockpitIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: "none", transition: "stroke .16s" }}
    >
      <path d={ICON_D[name]} />
    </svg>
  );
}
