# HydraSentry Discord Submission

Paste the block below in the HydraDB Discord at submission time (deadline: Sat 27 Jun, 1:30 PM IST). Keep it as-is. It is honest, concise, and leads with the differentiator.

---

**HydraSentry - Memory Integrity Certificates for HydraDB-powered agents**

HydraSentry poisons an agent's HydraDB memory graph, reruns the task, detects behavior drift, traces the exact query_paths the poison took, blocks unsafe context through MCP, verifies SkillMake skills, and exports a signed Memory Integrity Certificate.

**Live:** https://frontend-nu-ochre-z41mw3z0l5.vercel.app
**Backend:** https://backend-three-puce-75.vercel.app
**Repo:** https://github.com/vaibhav4046/hydrasentry

**The differentiator:** the Memory Integrity Certificate. Prompt injection is transient; memory poisoning persists. HydraSentry does not just flag that a prompt failed. It certifies the graph anatomy of how poisoned context reached the agent (tainted node, query_paths, chunk ids, tenant scope), records the MCP firewall decision that blocked the unsafe action, runs the SkillMake scan, quarantines the poison, and turns the incident into a regression rule, all in one signed certificate (e.g. MIC-2026-REFUND-001).

**SkillMake bounty:** HydraSentry automates the manual safety check skillmake.xyz tells users to do by hand, on the same HydraDB substrate. `POST /skillmake/scan-url` pulls the exact marketplace `SKILL.md` server-side and runs it through the static scanner. A benign skill scores LOW; the planted unsafe skill scores CRITICAL (100), blocked, with per-line findings. Walkthrough video included.

**Live HydraDB query on the public URL:** /graph runs a genuine live HydraDB query_paths traversal (not just derived demo): "Run live HydraDB query" hits a pre-warmed owned tenant and returns real triplets in ~3s with a query_ms proof, failing closed to a captured sample if HydraDB hiccups.

**What is real vs demo (honestly):** the live frontend makes real backend calls (deterministic 87 / HIGH / memory_poisoning / 0.92, sub-200ms); the hosted backend runs demo mode so its scenario graph is labelled derived; the public /graph runs a genuine live HydraDB query_paths traversal against a pre-warmed owned tenant (~3s, fails closed to the captured sample); real HydraDB query_paths also run locally (4/4 reliable, captured proof shown on /graph as REAL HYDRADB QUERY_PATHS CAPTURED); the SkillMake scan is real per-line detection; the MCP gateway is an HTTP control surface (MCP-inspired, stdio on the roadmap); scheduling is simulated; 72 backend tests pass.
