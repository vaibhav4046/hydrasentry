"use client";

/**
 * Minimal command palette for the cockpit top bar. Opens on Ctrl/Cmd+K (or by
 * clicking the search box, which calls openPalette()). Lists the dashboard pages
 * plus a "Run judge demo" action, filters by the typed query, and navigates (or
 * runs the demo) on select. Closes on Escape / outside click. Keyboard: arrows
 * to move, Enter to run the highlighted item. This replaces the previously dead
 * search field + ⌘K chip so the affordance actually does something.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COCKPIT_NAV } from "./cockpitNav";
import { useRunDemo } from "@/hooks/useRunDemo";
import { C } from "@/lib/cockpit/derive";

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

/** Module-level opener so the top-bar search box can trigger the palette. */
let externalOpen: (() => void) | null = null;
export function openPalette() {
  externalOpen?.();
}

export function CommandPalette() {
  const router = useRouter();
  const { trigger } = useRunDemo();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const pages: Command[] = COCKPIT_NAV.flatMap((g) =>
      g.items.map((it) => ({
        id: it.href,
        label: it.label,
        hint: `${g.label} · ${it.href}`,
        run: () => router.push(it.href),
      })),
    );
    return [
      {
        id: "run-demo",
        label: "Run judge demo",
        hint: "ACTION · memory_poisoning_refund → 87 / HIGH",
        run: () => {
          void trigger();
          router.push("/results");
        },
      },
      ...pages,
      {
        id: "home",
        label: "Landing page",
        hint: "SITE · /",
        run: () => router.push("/"),
      },
    ];
  }, [router, trigger]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.label.toLowerCase().includes(q) || c.hint.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Register the global Ctrl/Cmd+K shortcut + the external opener.
  useEffect(() => {
    externalOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      externalOpen = null;
    };
  }, []);

  // Focus the input when opening.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  if (!open) return null;

  // Clamp the highlight to the current result set (no set-state-in-effect).
  const activeCursor = Math.min(cursor, Math.max(0, filtered.length - 1));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor(Math.min(activeCursor + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor(Math.max(activeCursor - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[activeCursor];
      if (cmd) {
        cmd.run();
        close();
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={close}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "14vh",
        background: "rgba(2,3,4,0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        data-command-palette
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        style={{
          width: "min(560px, 92vw)",
          border: "1px solid rgba(234,240,250,0.14)",
          borderRadius: 14,
          background: "linear-gradient(180deg,rgba(14,17,22,0.98),rgba(6,8,10,0.98))",
          boxShadow: "0 30px 70px -28px rgba(0,0,0,0.85)",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          placeholder="Jump to a page or run the demo…"
          aria-label="Command palette search"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "15px 18px",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            outline: "none",
            color: C.ink,
            fontFamily: "inherit",
            fontSize: 14,
          }}
        />
        <div style={{ maxHeight: 340, overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.faint, padding: "14px 12px" }}>
              No matches.
            </div>
          )}
          {filtered.map((c, i) => {
            const on = i === activeCursor;
            return (
              <button
                key={c.id}
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  c.run();
                  close();
                }}
                style={{
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 9,
                  border: "1px solid transparent",
                  background: on ? "rgba(234,240,250,0.08)" : "transparent",
                  transition: "background .12s",
                }}
              >
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{c.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.faint }}>{c.hint}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
