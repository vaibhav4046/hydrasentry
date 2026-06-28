"use client";

/**
 * Connect-your-agent page. NO ACCOUNT, NO SIGN-IN, NO KEY-MINTING.
 *
 * Point your agent at HydraSentry by installing the stdio MCP server and wiring
 * any MCP-compatible client to it. Once connected, every risky memory your agent
 * retrieves is scored, certified, and lands in the public incident console. The
 * whole flow is public and copy-ready.
 */
import { ConsoleShell } from "@/components/auth/ConsoleShell";
import { ConnectAgentPanel } from "@/components/console/ConnectAgentPanel";

export default function KeysPage() {
  return (
    <ConsoleShell>
      <div data-page style={{ maxWidth: 760, margin: "0 auto" }}>
        <ConnectAgentPanel />
      </div>
    </ConsoleShell>
  );
}
