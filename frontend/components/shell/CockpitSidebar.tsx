"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COCKPIT_NAV } from "./cockpitNav";
import { CockpitIcon } from "./cockpitIcons";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { BUILD_SHORT } from "@/lib/build";
import { C } from "@/lib/cockpit/derive";

interface CockpitSidebarProps {
  /** Called after a nav link is followed (used to close the mobile drawer). */
  onNavigate?: () => void;
  /** True when a run is engaged, lights the SkillMake / Findings "1" badges. */
  engaged?: boolean;
}

const MONO = "var(--font-geist-mono), 'JetBrains Mono', monospace";

/**
 * The Castellan left command rail (248px), ported 1:1 from the source: the
 * HYDRASENTRY wordmark + glowing dot, a Refund Agent workspace selector card,
 * grouped icon nav with a left-edge active tick + count badges, and a
 * systems-nominal footer with mono meta lines. Sticky, hairline right border,
 * layered dark glass, blur(10px). Monochrome throughout.
 */
export function CockpitSidebar({ onNavigate, engaged }: CockpitSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      style={{
        position: "sticky",
        top: 0,
        zIndex: 3,
        height: "100vh",
        width: 248,
        borderRight: "1px solid rgba(255,255,255,0.07)",
        background:
          "linear-gradient(180deg,rgba(9,11,14,0.82),rgba(2,3,4,0.9))",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        display: "flex",
        flexDirection: "column",
        padding: "18px 14px 16px",
        overflow: "hidden",
      }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "baseline",
          textDecoration: "none",
          padding: "4px 8px 14px",
          fontSize: "15.5px",
          lineHeight: 1,
        }}
      >
        <span style={{ fontWeight: 400, letterSpacing: "0.32em", color: C.accentDim }}>
          HYDRASENTRY
        </span>
        <span
          style={{
            margin: "0 6px",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#fff",
            alignSelf: "center",
            boxShadow: "0 0 8px rgba(255,255,255,0.9)",
          }}
        />
      </Link>

      {/* Workspace selector (real dropdown, not a dead chevron) */}
      <WorkspaceSwitcher />

      {/* Grouped nav */}
      <nav
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 1,
          marginTop: 6,
        }}
      >
        {COCKPIT_NAV.map((group) => (
          <div key={group.label}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "8.5px",
                letterSpacing: "0.22em",
                color: C.ghost,
                padding: "10px 10px 4px",
              }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const on =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge =
                item.badgeWhenEngaged && !engaged ? "" : item.badge ?? "";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={on ? "page" : undefined}
                  style={{
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "7px 11px",
                    borderRadius: 9,
                    border: `1px solid ${on ? "rgba(234,240,250,0.14)" : "transparent"}`,
                    background: on ? "rgba(234,240,250,0.06)" : "transparent",
                    color: on ? C.ink : C.muted,
                    textDecoration: "none",
                    transition: "all .16s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: -1,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 2,
                      height: on ? 17 : 0,
                      borderRadius: "0 2px 2px 0",
                      background: on ? C.accent : "transparent",
                      transition: "height .2s",
                    }}
                  />
                  <CockpitIcon name={item.icon} color={on ? C.accent : "#6b7480"} />
                  <span style={{ fontSize: "12.5px", fontWeight: 500 }}>
                    {item.label}
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: MONO,
                      fontSize: 9,
                      color: on ? C.muted : C.ghost,
                    }}
                  >
                    {badge}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: systems nominal + meta */}
      <div
        style={{
          marginTop: 10,
          padding: "11px 10px 2px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.08em",
            color: C.muted,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.accent,
              boxShadow: `0 0 8px ${C.accent}`,
              animation: "hsPulseDot 2.6s ease-in-out infinite",
            }}
          />
          All systems nominal
        </div>
        <div
          style={{
            marginTop: 7,
            fontFamily: MONO,
            fontSize: 9,
            color: C.faint,
            lineHeight: 1.6,
          }}
        >
          demo · region lhr1 · build {BUILD_SHORT}
          <br />
          tenant owned · sub support_agent
        </div>
      </div>
    </aside>
  );
}
