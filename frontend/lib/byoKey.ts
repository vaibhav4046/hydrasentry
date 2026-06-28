/**
 * Client-side bring-your-own-key (BYO) store. NO LOGIN, NO SERVER PERSISTENCE.
 *
 * The user's LLM provider, model, and API key live ONLY in this browser's
 * localStorage. The key is NEVER sent to our backend to be stored: it is sent
 * per-request on a run (as X-Provider* headers) so that single run uses the
 * user's own model + key, and it is sent to POST /settings/providers/test purely
 * to validate it upstream (the backend exercises it once and drops it, never
 * persisting or logging it). When no key is saved, runs use the platform default
 * (Groq) -- the public demo path.
 *
 * This module is the single source of truth for the supported providers and
 * their "Get your key" links (each opens the provider's own key page).
 */

const STORAGE_KEY = "hydrasentry.byo.v1";

/** A supported BYO provider + where the user gets their key. */
export interface ByoProvider {
  /** Backend provider id (matches provider_credentials.ALLOWED_PROVIDERS). */
  id: string;
  /** Human label. */
  label: string;
  /** The provider's own key-issuing page (opens in a new tab). */
  getKeyUrl: string;
  /** A sensible default model so the user can run without typing one. */
  defaultModel: string;
  /** Placeholder hint for the key field (shape only, never a real key). */
  keyHint: string;
}

/**
 * The providers a user may bring a key for. The Get-your-key links are the
 * canonical provider key pages. Mirrors the backend ALLOWED_PROVIDERS.
 */
export const BYO_PROVIDERS: readonly ByoProvider[] = [
  {
    id: "groq",
    label: "Groq",
    getKeyUrl: "https://console.groq.com/keys",
    defaultModel: "meta-llama/llama-4-scout-17b-16e-instruct",
    keyHint: "gsk_…",
  },
  {
    id: "openai",
    label: "OpenAI",
    getKeyUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    keyHint: "sk-…",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    getKeyUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.5-flash-lite",
    keyHint: "AIza…",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-3-5-sonnet-latest",
    keyHint: "sk-ant-…",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    getKeyUrl: "https://openrouter.ai/keys",
    defaultModel: "deepseek/deepseek-chat-v3.1:free",
    keyHint: "sk-or-…",
  },
] as const;

export function providerById(id: string): ByoProvider | undefined {
  return BYO_PROVIDERS.find((p) => p.id === id);
}

/** The saved BYO selection (browser-only). The raw key is held here too because
 *  it must be re-sent per run; it never leaves the browser except as a request
 *  header to validate or to drive the user's own run. */
export interface SavedByoKey {
  provider: string;
  model: string;
  apiKey: string;
}

function isSaved(value: unknown): value is SavedByoKey {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.provider === "string" &&
    typeof v.model === "string" &&
    typeof v.apiKey === "string"
  );
}

// --- Change notification ----------------------------------------------------
//
// The saved BYO key is external browser state. A reactive reader re-reads when
// it changes: in another tab via the native `storage` event, and in this tab
// via this small custom event the writers dispatch.

const BYO_EVENT = "hydrasentry:byo-changed";

function notifyByoChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BYO_EVENT));
}

/** Subscribe to BYO key changes for useSyncExternalStore: same-tab writes (the
 *  custom event) and cross-tab writes (the native `storage` event). */
export function subscribeByoKey(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(BYO_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(BYO_EVENT, onChange);
  };
}

// useSyncExternalStore requires getSnapshot to return a referentially STABLE
// value when nothing changed. We cache the parsed object keyed on the raw
// localStorage string so React does not see a new object every render (which
// would loop). The cache is recomputed only when the raw string actually
// changes (a save / remove / cross-tab write).
let _snapRaw: string | null | undefined;
let _snapValue: SavedByoKey | null = null;

function rawValue(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Client snapshot for useSyncExternalStore (memoised on the raw string). */
export function byoKeySnapshot(): SavedByoKey | null {
  const raw = rawValue();
  if (raw === _snapRaw) return _snapValue;
  _snapRaw = raw;
  _snapValue = loadByoKey();
  return _snapValue;
}

/** Server snapshot for useSyncExternalStore: no key during SSR/prerender. */
export function byoKeyServerSnapshot(): SavedByoKey | null {
  return null;
}

/** Read the saved BYO key from localStorage, or null when none / unparseable. */
export function loadByoKey(): SavedByoKey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSaved(parsed)) return null;
    if (!parsed.provider || !parsed.apiKey) return null;
    if (!providerById(parsed.provider)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the BYO key to localStorage (browser-only). */
export function saveByoKey(value: SavedByoKey): void {
  if (typeof window === "undefined") return;
  const provider = providerById(value.provider);
  if (!provider) return;
  const payload: SavedByoKey = {
    provider: value.provider,
    model: value.model.trim() || provider.defaultModel,
    apiKey: value.apiKey,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    notifyByoChanged();
  } catch {
    /* storage full / blocked: the run simply falls back to platform default */
  }
}

/** Clear any saved BYO key (runs fall back to the platform default). */
export function clearByoKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    notifyByoChanged();
  } catch {
    /* ignore */
  }
}

/** Mask a key for display: show only a short, non-reversible tail context.
 *  Never renders the full secret. */
export function maskKey(apiKey: string): string {
  const k = apiKey.trim();
  if (k.length <= 4) return "••••";
  return `••••••••${k.slice(-4)}`;
}

/**
 * Per-request provider headers for a run. Returns the X-Provider* headers when a
 * BYO key is saved so the run uses the user's own model + key; returns an empty
 * object when none is saved (the run then uses the platform default). The key is
 * placed in a header on the single run request only -- never stored server-side.
 */
export function byoRunHeaders(): Record<string, string> {
  const saved = loadByoKey();
  if (!saved) return {};
  const provider = providerById(saved.provider);
  if (!provider) return {};
  return {
    "X-Provider": saved.provider,
    "X-Provider-Key": saved.apiKey,
    "X-Provider-Model": saved.model || provider.defaultModel,
  };
}
