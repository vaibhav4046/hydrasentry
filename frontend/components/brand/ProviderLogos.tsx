"use client";

/**
 * Authentic provider brand marks for the Configuration page (T3).
 *
 * Each export is an inline SVG of the provider's official mark, rendered next to
 * a brand-colored wordmark. This is the ONE deliberate exception to the
 * monochrome design system: the provider identity is the trust signal on the
 * Configuration surface, so the logos carry their real brand hex. Everything
 * else on the page stays monochrome.
 *
 * `Local` is not a third-party brand, so it is rendered monochrome (a neutral
 * chip glyph + silver wordmark) — the local risk classifier, not a vendor.
 *
 * Marks are simplified, self-drawn paths in the spirit of each brand (no
 * copyrighted asset files bundled); colors use the official brand hex.
 */
import type { CSSProperties } from "react";

export interface ProviderBrand {
  /** Display wordmark text. */
  wordmark: string;
  /** Brand hex for the wordmark (monochrome silver for non-brands). */
  color: string;
  /** The mark, sized to ~22px. */
  Mark: (props: { size?: number }) => React.JSX.Element;
}

const WORDMARK_BASE: CSSProperties = {
  fontWeight: 650,
  fontSize: 16,
  letterSpacing: "-0.01em",
  lineHeight: 1,
};

/** Groq — official tilt-square "G" mark, brand orange. */
function GroqMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#F55036" />
      <path
        d="M24 12.5c-6.35 0-11.5 5.15-11.5 11.5S17.65 35.5 24 35.5h4.4v-4.3H24a7.2 7.2 0 1 1 7.2-7.2v6.1a3.6 3.6 0 0 1-6.15 2.55l-3.04 3.04A7.9 7.9 0 0 0 35.5 30.2V24c0-6.35-5.15-11.5-11.5-11.5Z"
        fill="#fff"
      />
    </svg>
  );
}

/** Google Gemini — the four-point spark, blue→purple→magenta brand gradient. */
function GeminiMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gemini-grad" x1="2" y1="4" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9168C0" />
          <stop offset="1" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        d="M12 0c.27 6.42 5.58 11.73 12 12-6.42.27-11.73 5.58-12 12-.27-6.42-5.58-11.73-12-12C6.42 11.73 11.73 6.42 12 0Z"
        fill="url(#gemini-grad)"
      />
    </svg>
  );
}

/** OpenRouter — concentric router rings, brand indigo. */
function OpenRouterMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12h4M18 12h4"
        stroke="#6467F2"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6 8.5c2.2 2 3.6 2 6 2s3.8 0 6-2M6 15.5c2.2-2 3.6-2 6-2s3.8 0 6 2"
        stroke="#6467F2"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.4" fill="#6467F2" />
    </svg>
  );
}

/** Anthropic — the Claude burst mark, brand clay. */
function AnthropicMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 32" fill="none" aria-hidden>
      <path
        d="M32.73 0H26.1l11.9 32h6.66L32.73 0ZM13.27 0 1.34 32h6.8l2.44-6.74h12.46L25.5 32h6.8L20.36 0h-7.1Zm-.55 19.5L16.8 8.2l4.08 11.3h-8.16Z"
        fill="#D97757"
      />
    </svg>
  );
}

/** OpenAI — the official blossom/knot mark, brand teal. */
function OpenAIMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.55 10.04a5.42 5.42 0 0 0-.47-4.45 5.49 5.49 0 0 0-5.9-2.63A5.43 5.43 0 0 0 11.1 1.2a5.49 5.49 0 0 0-5.23 3.8 5.43 5.43 0 0 0-3.63 2.63 5.49 5.49 0 0 0 .67 6.43 5.42 5.42 0 0 0 .47 4.45 5.49 5.49 0 0 0 5.9 2.63A5.43 5.43 0 0 0 12.9 22.8a5.49 5.49 0 0 0 5.23-3.8 5.43 5.43 0 0 0 3.63-2.63 5.49 5.49 0 0 0-.21-6.33ZM12.9 21.3a4.07 4.07 0 0 1-2.6-.94l3.86-2.23a.63.63 0 0 0 .32-.55v-5.44l1.63.94v4.5a4.08 4.08 0 0 1-3.21 3.72ZM5.05 17.9a4.06 4.06 0 0 1-.49-2.73l3.86 2.23c.2.12.44.12.64 0l4.71-2.72v1.88l-4.06 2.35a4.08 4.08 0 0 1-4.7-.96Zm-1.02-8.4a4.06 4.06 0 0 1 2.12-1.78v4.55c0 .23.12.44.32.55l4.71 2.72-1.63.94-4.06-2.34a4.08 4.08 0 0 1-1.46-4.64ZM17.6 12.9l-4.71-2.72 1.63-.94 4.06 2.34a4.07 4.07 0 0 1-.63 7.36V13.5a.63.63 0 0 0-.32-.55l.01-.05Zm1.62-2.44-3.86-2.23a.63.63 0 0 0-.64 0L10 10.95V9.07l4.06-2.34a4.07 4.07 0 0 1 5.15 6.16l.01-2.43ZM9.13 13.84 7.5 12.9v-4.5a4.07 4.07 0 0 1 6.67-3.13l-3.86 2.23a.63.63 0 0 0-.32.55l-.86 5.79.01-.05Zm.88-1.91L12.12 10.7l2.11 1.22v2.43l-2.11 1.22-2.11-1.22v-2.42Z"
        fill="#0FA47F"
      />
    </svg>
  );
}

/** Local — not a brand: monochrome chip glyph. */
function LocalMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="#D9DEE7" strokeWidth="1.6" />
      <rect x="10" y="10" width="4" height="4" rx="0.6" fill="#D9DEE7" />
      <path
        d="M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3"
        stroke="#D9DEE7"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Registry keyed by the backend provider `name` (lowercase). */
export const PROVIDER_BRANDS: Record<string, ProviderBrand> = {
  groq: { wordmark: "Groq", color: "#F55036", Mark: GroqMark },
  gemini: { wordmark: "Google Gemini", color: "#4285F4", Mark: GeminiMark },
  openrouter: { wordmark: "OpenRouter", color: "#6467F2", Mark: OpenRouterMark },
  anthropic: { wordmark: "Anthropic", color: "#D97757", Mark: AnthropicMark },
  openai: { wordmark: "OpenAI", color: "#0FA47F", Mark: OpenAIMark },
  local: { wordmark: "Local", color: "#D9DEE7", Mark: LocalMark },
};

/**
 * Logo + brand-colored wordmark for a provider, looked up by name. Falls back to
 * a monochrome text wordmark for any unknown provider so the card never breaks.
 */
export function ProviderLogo({ name }: { name: string }) {
  const brand = PROVIDER_BRANDS[name?.toLowerCase?.() ?? ""];
  if (!brand) {
    return (
      <span style={{ ...WORDMARK_BASE, color: "#F3F6FB" }}>{name}</span>
    );
  }
  const { Mark, wordmark, color } = brand;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <Mark size={22} />
      <span style={{ ...WORDMARK_BASE, color }}>{wordmark}</span>
    </span>
  );
}
