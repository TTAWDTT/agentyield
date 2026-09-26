import assert from "node:assert/strict";
import test from "node:test";
import { privacyModeFromValue, redactEvents } from "../src/privacy.js";
import type { AgentEvent } from "../src/types.js";

const event: AgentEvent = {
  id: "e1",
  kind: "turn",
  ts: "2026-09-26T10:00:00Z",
  agent: "codex",
  sessionId: "s1",
  prompt: "private prompt",
  output: "private output",
  usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 2, totalTokens: 3 },
  source: { file: "f", line: 1 },
};

test("redaction removes prompt and output but keeps usage evidence", () => {
  const [redacted] = redactEvents([event]);
  assert.equal("prompt" in redacted, false);
  assert.equal("output" in redacted, false);
  assert.equal(redacted.usage?.inputTokens, 1);
});

test("privacy mode parser accepts only documented values", () => {
  assert.equal(privacyModeFromValue(undefined), "full");
  assert.equal(privacyModeFromValue(true), "redact-text");
  assert.equal(privacyModeFromValue("redact"), "redact-text");
  assert.throws(() => privacyModeFromValue("cloud"), /Unsupported privacy mode/);
});
