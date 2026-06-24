import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { COLORS, FONTS } from "./theme";

type Props = {
  text: string;
  /** Local frame where typing starts. */
  startFrame: number;
  /** Characters revealed per frame. */
  cps?: number;
  fontSize?: number;
  color?: string;
  /** Show a blinking caret after the last character. */
  caret?: boolean;
  prefix?: string;
  style?: React.CSSProperties;
};

/**
 * Monospace terminal text reveal — characters appear one at a time with a
 * blinking block caret. Used for agent prompts and poisoned output.
 */
export const TerminalType: React.FC<Props> = ({
  text,
  startFrame,
  cps = 1.4,
  fontSize = 30,
  color = COLORS.textPrimary,
  caret = true,
  prefix,
  style,
}) => {
  const frame = useCurrentFrame();
  const revealed = Math.max(
    0,
    Math.floor((frame - startFrame) * cps)
  );
  const shown = text.slice(0, revealed);
  const done = revealed >= text.length;
  const caretOn = Math.floor(frame / 15) % 2 === 0;

  return (
    <span
      style={{
        fontFamily: FONTS.mono,
        fontSize,
        color,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        ...style,
      }}
    >
      {prefix ? (
        <span style={{ color: COLORS.textMuted }}>{prefix}</span>
      ) : null}
      {shown}
      {caret && (!done || caretOn) ? (
        <span
          style={{
            display: "inline-block",
            width: fontSize * 0.5,
            height: fontSize * 0.95,
            marginLeft: 2,
            transform: "translateY(2px)",
            background: caretOn ? COLORS.white : "transparent",
          }}
        />
      ) : null}
    </span>
  );
};

/** A framed terminal panel (glass card) wrapping terminal content. */
export const TerminalPanel: React.FC<{
  title?: string;
  children: React.ReactNode;
  width?: number;
  appear?: number;
}> = ({ title, children, width = 980, appear = 1 }) => {
  return (
    <div
      style={{
        width,
        borderRadius: 16,
        border: `1px solid ${COLORS.border}`,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.025))",
        boxShadow: "0 24px 90px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        backdropFilter: "blur(22px)",
        overflow: "hidden",
        opacity: appear,
        transform: `translateY(${interpolate(appear, [0, 1], [16, 0])}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.25)" }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.16)" }} />
        <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.10)" }} />
        {title ? (
          <span
            style={{
              marginLeft: 12,
              fontFamily: FONTS.mono,
              fontSize: 13,
              letterSpacing: "2px",
              color: COLORS.textMuted,
            }}
          >
            {title}
          </span>
        ) : null}
      </div>
      <div style={{ padding: "22px 26px" }}>{children}</div>
    </div>
  );
};
