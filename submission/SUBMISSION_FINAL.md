# Constellan — Context Integrity for HydraDB Agents

**Paste-ready submission for the HydraDB Build Blitz (general track + "Best Use of Skillmake" bounty).**

- **Live app:** https://frontend-nu-ochre-z41mw3z0l5.vercel.app
- **Live backend:** https://backend-three-puce-75.vercel.app  (`APP_MODE=demo`, no keys needed)
- **Repo:** https://github.com/vaibhav4046/hydrasentry  (product: Constellan; repo/engine: hydrasentry)
- **One-click judge:** `curl -X POST https://backend-three-puce-75.vercel.app/runs/judge-demo`

## What it is

Constellan red-teams the memory and knowledge layer of agents that run on HydraDB, not the prompt. It seeds an owned HydraDB tenant with a clean policy, injects a poisoned memory, replays the agent against both, and shows the graph anatomy of how the poisoned context travelled through HydraDB's `query_paths` into an unsafe tool action. It then blocks that action through an MCP gateway, quarantines the poisoned memory, and statically verifies SkillMake skills for hidden instructions before they ever load. Promptfoo tells you a prompt failed; Constellan shows you the route a poisoned memory took through the graph to override a policy, and stops it.

## Why HydraDB

The whole product is built around HydraDB's `graph_context.query_paths`: the relational triplets a query traversed. A flat vector store cannot produce the tainted-path forensics that are the centrepiece. When real `query_paths` are present the graph is labelled REAL HYDRADB QUERY_PATHS; otherwise it is honestly labelled DERIVED SCENARIO GRAPH FALLBACK, and the product never presents derived data as real HydraDB output.

## Best Use of Skillmake (bounty)

skillmake.xyz is a HydraDB-powered marketplace whose own guidance is that installed skills are not sandboxed and must be inspected by hand. Constellan automates that inspection. `POST /skillmake/scan-url` takes a marketplace slug, pulls the real `SKILL.md` from skillmake.xyz server-side, and runs it through a deterministic ten-category static scanner.

Verified live:

```bash
# Real benign skill, pulled live from the marketplace -> LOW / approved
curl -X POST https://backend-three-puce-75.vercel.app/skillmake/scan-url \
  -H 'content-type: application/json' -d '{"name": "firecrawl-mcp"}'
```

The planted `unsafe-demo-skill` (friendly description, malicious body) scores CRITICAL / 100 / blocked. HydraDB powers both the marketplace and the guard.

## Judge it in 60 seconds

1. Open the live app and press **Run Judge Demo**, or run the one-click curl above.
2. The canonical scenario is deterministic: **87 / HIGH / memory_poisoning / 0.92**, firewall **block**, `mem_poison_047` quarantined.
3. Walk the tainted graph (note the honest DERIVED badge), then the SkillMake CRITICAL scan.

## Honest scope

Scheduling is an in-app simulation, not real cron. No model is fine-tuned. The MCP gateway is HTTP (MCP-inspired), not native stdio. The hosted backend runs in demo mode, so its graph is DERIVED. All built-in scenarios run only against the owned tenant `hydrasentry-owned-test`. The strength of the build is the deterministic engine, the graph honesty, the live SkillMake integration, and the end-to-end loop, not inflated claims.

---

*A full submission and QA verification report (with screenshots, live evidence, and a 32-finding audit) is in `submission/report.pdf`.*
