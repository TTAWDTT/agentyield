# AgentYield

![CI](https://github.com/TTAWDTT/agentyield/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-green)

**A local-first ROI and evidence ledger for AI coding agents.**

Most tools stop at token dashboards. AgentYield joins what an agent spent with
what actually changed in Git, then produces explainable yield reports and
tamper-evident receipts.

This project is independently designed, built, and iterated by **Codex**.

## Why

AI coding tools can usually tell you:

- how many tokens you used;
- how much a session cost.

They usually cannot answer:

- which sessions actually produced commits?
- how much rework followed a session?
- which workflows have the best output per 1,000 output tokens?
- whether the evidence survives export, audit, or an offline review?

AgentYield is a local-first answer to that gap. No telemetry, no account, no
model calls.

## Install

```bash
npm install -g agentyield
```

Or run from a clone:

```bash
npm install
npm run build
node dist/src/cli.js --help
```

## Quick start

```bash
agentyield init
agentyield discover --agent codex --days 7
agentyield ingest --agent codex --auto --days 7 --dry-run
agentyield ingest --agent codex --auto --days 7
agentyield git --days 30
agentyield report --days 30
agentyield dashboard --port 4173
```

Use `agentyield doctor` to discover likely local Claude Code and Codex session
log locations without reading their contents.

## What it measures

AgentYield emits conservative, evidence-backed metrics:

- **Input / output / cached tokens** normalized across adapters.
- **Provider-declared cost** when present; no invented pricing by default.
- **Commits and file churn** from local Git history.
- **Session-to-commit attribution** with an explicit confidence label.
- **Yield ratio** defined as commits per 1,000 output tokens.
- **Zero-commit spend surface** for sessions with measurable cost or tokens.
- **Hash-chained receipts** for auditable snapshots.

AgentYield does not claim a developer was productive because tokens went up or
down. Every report includes the evidence used to compute it.

## Receipts

```bash
agentyield receipt --commit 1234567 --session-id <id>
agentyield verify
```

Receipts are stored in `.agentyield/receipts.jsonl`. Each receipt contains the
previous hash and its own canonical SHA-256 hash, making silent edits detectable.

## Adapter model

AgentYield starts with a small normalized event model:

```json
{"type":"turn","ts":"2026-09-26T10:00:00Z","session_id":"s1","agent":"codex","model":"example","usage":{"input_tokens":1200,"output_tokens":480}}
```

The first-class adapters are:

- Claude Code JSONL sessions;
- Codex CLI response streams;
- the generic AgentYield event stream.

See [`docs/ADAPTERS.md`](docs/ADAPTERS.md) for field mapping.

## Privacy

- Data remains in your repository or explicitly selected directory.
- No telemetry, no model inference, no remote account.
- Reports can exclude prompt and output text.
- `doctor` only counts candidate log files; it does not read them.

## Product model

The core is MIT-licensed. We keep the individual workflow open. Potential paid
extensions are described in [`docs/MONETIZATION.md`](docs/MONETIZATION.md), but
the local ledger and basic reports will not become closed source.

## Development

```bash
npm install
npm test
npm run build
```

CI runs type checking, tests, and package build on Node 22 and 24.

## Status

`v0.1.0` is the first public development milestone:

- local ledger;
- Claude Code, Codex, and generic JSONL ingestion;
- Git attribution and reporting;
- local dashboard;
- hash-chained receipts;
- CI and package metadata.

The project is being actively iterated by Codex.





## MCP server\n\nExpose local evidence to MCP-compatible coding agents:\n\n```bash\nagentyield mcp --root /path/to/project\n```\n\nAvailable tools:\n\n- `agentyield_report`\n- `agentyield_sessions`\n- `agentyield_receipts`\n\nSee [`docs/MCP.md`](docs/MCP.md).\n\n## Cost policy\n\nAgentYield never invents provider pricing. It reports **declared cost** only when\nthe adapter supplies it.\n\nFor offline planning, you can provide your own pricing file:\n\n```bash\nagentyield report --days 30 --pricing examples/pricing.example.json\n```\n\nEstimated cost is kept separate from declared cost and is omitted unless the\npricing file is explicitly supplied.\n\n## Privacy mode

For a safer team analysis, keep only measurable evidence and drop prompt/output
text at import time:

```bash
agentyield init --privacy redact-text
agentyield ingest --agent codex --auto --days 7
```

With `redact-text`, the ledger retains timestamps, model, tool names, token
counts, declared cost, session ids, and attribution evidence, but not prompt or
output text.




