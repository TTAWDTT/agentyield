# Monetization model

AgentYield's core is MIT-licensed. The product can earn without closing the
individual ledger.

## Paid direction (not yet implemented)

1. **Team roll-up server**
   - Aggregate opt-in, redacted yield reports from multiple developers.
   - Team/organization/project leaderboards.
   - Budget guardrails and SSO.
   - This is the first plausible paid tier.

2. **CI / GitHub App**
   - Post a concise AgentYield report on each PR.
   - Compare AI-assisted cost against review latency and rework.
   - Store only metrics and commit hashes, not prompts or diffs.

3. **Compliance exports**
   - AI-assistance receipt packs for audit.
   - Export to JSONL, CSV, or SARIF-like evidence bundles.
   - Retention policy controls for enterprise.

4. **Hosted benchmarking**
   - Anonymous, opt-in benchmark of agent workflows.
   - No code, no prompts, no output text in the hosted tier.

## Paid-extension boundary

The local ledger, local dashboard, event schema, adapters, receipts, and basic
reports remain MIT-licensed open source.

A commercial extension may add:

- collaboration;
- centralized authentication;
- organization-level storage;
- managed retention;
- support and SLAs.

## Positioning

AgentYield is not an LLM gateway. It is the accounting and evidence layer for
work already done locally by coding agents. That keeps the project useful
without requiring a GPU or a model provider account.
