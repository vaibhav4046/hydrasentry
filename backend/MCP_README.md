# hydrasentry-mcp

Native **stdio Model Context Protocol** server for HydraSentry. Install it into
any MCP client to run HydraSentry's real context-integrity tools on your own
agent. It implements the MCP JSON-RPC protocol directly over stdin/stdout, so it
needs no MCP SDK and runs offline.

## Install

```bash
pip install -e .
hydrasentry-mcp          # serve MCP over stdio
python -m hydrasentry_mcp # equivalent
```

## MCP client config (generic)

```json
{
  "mcpServers": {
    "hydrasentry": {
      "command": "hydrasentry-mcp",
      "env": {
        "HYDRA_DB_API_KEY": "your-hydradb-key-optional",
        "APP_MODE": "real",
        "GROQ_API_KEY": "your-groq-key-optional",
        "HYDRASENTRY_CERT_SECRET": "any-strong-secret-optional",
        "HYDRASENTRY_MCP_SECRET": "required-to-enable-write-tools"
      }
    }
  }
}
```

## Tools

- `scan_skill(skill_markdown, name?)` — static SKILL.md safety scan: risk band,
  score, per-line findings, recommended fix. No key.
- `scan_skill_url(slug)` — pull a SKILL.md from skillmake.xyz then scan it
  (offline cache fallback). No key.
- `scan_context(memories, task?, policy?)` — poison/integrity scan over agent
  memories: risk band, tainted path, firewall decision, findings. No key.
- `query_memory_graph()` — live HydraDB `query_paths` against the pre-warmed
  owned tenant. Requires a HydraDB key; honest fail-closed message without one.
- `run_memory_attack()` — real Groq-agent attack: baseline vs poisoned answer +
  computed risk. Requires HydraDB and Groq keys; honest deterministic fallback
  without them.
- `generate_certificate(scan)` / `verify_certificate(certificate)` — issue and
  verify a tamper-evident Memory Integrity Certificate over a scan result.

### Write-tool authorisation (fail-closed)

`query_memory_graph` and `run_memory_attack` trigger real outbound work / real
spend, so they are **write tools** and are gated on a shared secret:

- Set `HYDRASENTRY_MCP_SECRET` in the server env, and pass a matching
  `"secret"` argument in the tool call.
- If `HYDRASENTRY_MCP_SECRET` is **unset**, write tools are **refused**
  (fail-closed) — never silently run. Read tools (`scan_skill`, `scan_context`,
  `verify_certificate`, …) are always available.
- The compare is constant-time (`hmac.compare_digest`).

Every tool calls the real HydraSentry backend. Key-gated tools fail closed with
an honest message; they never fabricate output. Tests live in
`tests/test_mcp_server.py`.
