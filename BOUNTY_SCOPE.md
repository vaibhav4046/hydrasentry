# Bug-Bounty Scope

**Paste official bounty scope here before running any bounty tests.**

```
<official scope goes here — assets in scope, out-of-scope assets, rules of engagement, contact>
```

---

## Bug-bounty mode is DISABLED by default

HydraSentry does not run any test against a system you do not own unless an official, written scope is pasted above. **If official scope is missing, bug-bounty mode is DISABLED.** All built-in scenarios run only against tenants and subtenants this app created (`hydrasentry-owned-test`).

## Safety rules (always apply, even with scope)

- **No production systems outside published scope.** Only assets explicitly listed in the official scope above may be tested.
- **No other users' data.** Never access, read, or exfiltrate data belonging to any real user.
- **No authentication or authorization bypass** against systems you do not own.
- **No destructive testing.** No deletion, corruption, denial of service, or state damage.
- **No traffic amplification.** No load testing, flooding, brute forcing, or any technique that amplifies traffic against a target.
- **Cross-tenant tests are owned-only.** Any cross-tenant or cross-subtenant test runs *exclusively* against tenants and subtenants created by this app. The `cross_subtenant_leak` scenario creates both the attacker and victim subtenants itself; it never points at real tenants.

## If you find a real issue in a third-party system

Stop testing immediately, write up the finding with clear reproduction steps and a suggested fix, and disclose it privately to the owner. Do not publish details before the owner has had a chance to remediate. (The `hydrasentry-context-probe` skill documents this responsible-disclosure flow.)
