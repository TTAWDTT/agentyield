# Adapter schema

AgentYield reads newline-delimited JSON. A malformed line is skipped so one bad
record does not destroy a long session import.

A normalized event must have:

- `timestamp`, `ts`, `created_at`, or `createdAt`;
- `session_id`, `sessionId`, `conversation_id`, or `conversationId`.

Everything else is optional.

## Common fields

| Normalized field | Accepted source fields |
|---|---|
| timestamp | `ts`, `timestamp`, `created_at`, `createdAt` |
| session id | `session_id`, `sessionId`, `conversation_id`, `conversationId` |
| project | `project`, `project_path`, `cwd` |
| model | `model`, `model_name`, `message.model` |
| input tokens | `usage.input_tokens`, `usage.prompt_tokens`, `usage.inputTokens` |
| cached input tokens | `usage.cache_read_input_tokens`, `usage.cachedInputTokens` |
| output tokens | `usage.output_tokens`, `usage.completion_tokens`, `usage.outputTokens` |
| declared cost | `usage.cost_usd`, `usage.costUSD`, `usage.cost`, `cost_usd`, `costUSD`, `cost` |

If usage is absent but prompt/output text is present, AgentYield estimates tokens
using characters/4. The estimate is only used when provider usage is unavailable.

## Claude Code

Current mapping:

- `type: assistant/user/message` becomes a `turn`;
- `message.usage.input_tokens` becomes `usage.inputTokens`;
- `message.usage.cache_read_input_tokens` becomes `usage.cachedInputTokens`;
- `message.usage.output_tokens` becomes `usage.outputTokens`;
- `message.content` is flattened when it is an array of text parts.

## Codex CLI response streams

Current mapping:

- `response.completed` becomes a `turn` or `result`;
- `response.usage.input_tokens` becomes `usage.inputTokens`;
- `response.usage.output_tokens` becomes `usage.outputTokens`;
- `response.output` is flattened when possible.

## Generic AgentYield event stream

Use this when another agent or proxy can export normalized events:

```json
{"type":"turn","ts":"2026-09-26T10:00:00Z","session_id":"s1","agent":"generic","model":"example","usage":{"input_tokens":1200,"output_tokens":480,"cost_usd":0.012}}
```

Tool events may include:

```json
{"type":"tool","ts":"2026-09-26T10:00:05Z","session_id":"s1","agent":"generic","tool_name":"edit_file","duration_ms":120,"ok":true}
```

## Attribution evidence

For each Git commit, AgentYield records:

- matched `sessionId`;
- matching `agent`;
- absolute time delta;
- confidence (`high`, `medium`, or `low`);
- evidence type.

High confidence requires the session id to appear in the commit subject.
Otherwise, AgentYield uses the nearest event inside the configured window and
labels the evidence as `nearest-event-time`.
