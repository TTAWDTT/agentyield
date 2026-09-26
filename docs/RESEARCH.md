# Research log and positioning

This note records the initial market research used before committing to the
AgentYield direction. It will be revised as the project iterates.

## Observed market pressure

AI coding agents are now widely used, but the measurement layer is immature.
There are many token dashboards, but few tools join local session evidence with
Git outcomes, review risk, and cost in an auditable local ledger.

Companies increasingly ask for:

- per-task agent spend;
- reproducible evidence for AI-assisted changes;
- an exportable audit trail without shipping source code to another cloud;
- a way to compare sessions, projects, teams, and workflows.

## Existing tool landscape

During the first research pass, the following categories were reviewed through
GitHub and public discussion signals:

| Category | Examples | Gap AgentYield targets |
| --- | --- | --- |
| Token dashboards | splitrail, token-meter, AgentMeter | They answer "how much was used", not "what did it produce?" |
| LLM observability | Langfuse, Phoenix, OpenLLMetry | Usually app/platform telemetry; less tied to local coding-agent Git outcomes. |
| Agent governance | Aegis, agent audit tools | Focus on permission/control; AgentYield focuses on outcome and evidence yield. |
| AI provenance | agentdiff | Strong line-level provenance angle; AgentYield is a broader local ROI ledger and reporting layer. |

This is not a claim that competitors are weak. It is a scoping boundary:
AgentYield deliberately avoids becoming another generic LLM gateway or token
meter.

## Selected wedge

**AgentYield** starts with one job: turn local AI coding sessions plus Git
history into conservative, explainable, exportable yield evidence.

The first wedge is deliberately small:

1. normalize local session logs;
2. join them to local Git commits by explicit and time evidence;
3. report tokens, declared cost, commits, churn, and zero-commit sessions;
4. preserve hash-chained receipts for later audit.

## Design principles

1. **No invented productivity score.** Use transparent formulas and disclose
   limitations.
2. **No fabricated cost.** If the provider did not report cost, do not guess.
3. **Local-first.** The user's code and session content stay local.
4. **Auditable.** Hash-chain every receipt.
5. **Adapters before UI.** A dashboard without reliable evidence is decoration.

## Non-goals in v0.1

- Real-time process interception.
- Cloud aggregation.
- Team identity management.
- Automatic sentiment or productivity scoring.
- Paid closed-source analytics.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Log formats change between agent versions | Keep adapters isolated and use fixture tests. |
| Attribution is uncertain | Store confidence and evidence; never silently convert correlation to causation. |
| Users fear reading private logs | `doctor` only counts candidate files; ingestion is explicit. |
| ROI becomes vanity metrics | Report Git churn and limitations; do not call LOC productivity. |
| Enterprise compliance requirements drift | Keep receipts schema versioned and verifyable offline. |
