# Roadmap

## v0.1 — local evidence ledger

- [x] Normalized Claude Code, Codex, and generic JSONL adapters.
- [x] Local ledger with duplicate suppression.
- [x] Git history loading and session attribution.
- [x] JSON, Markdown, and terminal reports.
- [x] Local dashboard.
- [x] Hash-chained receipts.
- [x] CI.

## v0.2 — adoption

- [x] Privacy-aware `init --privacy redact-text`.
- [x] `discover` and `ingest --auto` for Claude Code and Codex.
- [ ] Better fixture corpus and snapshot tests.
- [ ] SQLite query backend for large logs.
- [ ] GitHub Action for PR yield summaries.

## v0.3 — team workflows

- [ ] Signed receipts with Ed25519.
- [ ] Team aggregation export schema.
- [ ] Rollup across many repositories.
- [ ] Rework/churn over commit lifetime.

## v0.4 — ecosystem

- [ ] Plugin API for additional agent logs.
- [x] Local MCP stdio server for report/session/receipt queries.
- [ ] Remote MCP server diagnostics.
- [ ] Enterprise compliance report templates.

## Principles

- Keep evidence local unless the user explicitly exports it.
- Never infer cost where the provider did not provide it.
- Never present heuristic attribution as ground truth.
- Keep open core; monetize team trust and collaboration, not lock-in.





