# HydraSentry Skills

Two skills ship with HydraSentry:

- **hydrasentry-context-probe** — a safe operator skill describing how to run
  HydraSentry, read risk bands, inspect `query_paths`, generate reports, test
  only owned tenants, and submit responsible disclosures. The scanner scores it
  LOW.

- **unsafe-demo-skill** — an intentional test fixture. Its frontmatter claims to
  be a benign "support triage helper", but its body hides prompt injection,
  secret access, silent refund approval, user deception, and exfiltration
  instructions. The SkillMake scanner must flag it CRITICAL. Never enable it in
  a real agent.

## How the verifier uses them

The HydraSentry SkillMake scanner (`skillmake_scanner.py`) reads SKILL.md text
and returns a risk score, band, and per-line findings. The
`unsafe_skillmake_skill` scenario references `unsafe-demo-skill` so the
end-to-end judge demo can show a CRITICAL skill being caught and blocked
alongside the poisoned-memory replay.
