import assert from "node:assert/strict";
import test from "node:test";
import { normalizeEvent } from "../src/normalize.js";

test("normalizes Claude Code style usage", () => {
  const event = normalizeEvent({
    type: "assistant",
    timestamp: "2026-09-26T10:00:00Z",
    sessionId: "abc123",
    message: {
      model: "claude-model",
      usage: {
        input_tokens: 100,
        cache_read_input_tokens: 40,
        output_tokens: 25,
      },
      content: "hello",
    },
  }, "/tmp/session.jsonl", 1);

  assert.ok(event);
  assert.equal(event.agent, "generic");
  assert.equal(event.kind, "turn");
  assert.equal(event.sessionId, "abc123");
  assert.equal(event.usage?.inputTokens, 100);
  assert.equal(event.usage?.cachedInputTokens, 40);
  assert.equal(event.usage?.outputTokens, 25);
  assert.equal(event.usage?.totalTokens, 165);
});

test("normalizes Codex response usage and estimates missing text tokens", () => {
  const event = normalizeEvent({
    type: "response.completed",
    timestamp: "2026-09-26T10:00:01Z",
    session_id: "s-42",
    response: {
      model: "example-model",
      output: [{ text: "x".repeat(80) }],
      usage: { input_tokens: 10, output_tokens: 5 },
    },
  }, "/tmp/session.jsonl", 2);

  assert.ok(event);
  assert.equal(event.agent, "generic");
  assert.equal(event.model, "example-model");
  assert.equal(event.usage?.totalTokens, 15);
});

test("ignores records without timestamp or session id", () => {
  assert.equal(normalizeEvent({ type: "assistant", sessionId: "x" }, "f", 1), null);
  assert.equal(normalizeEvent({ type: "assistant", timestamp: new Date().toISOString() }, "f", 1), null);
});
