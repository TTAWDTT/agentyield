import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendReceipt, createReceipt, verifyReceipts, canonicalJson } from "../src/receipt.js";
import { readReceipts, writeReceipts, readEvents } from "../src/ledger.js";
import type { AgentEvent, GitCommit } from "../src/types.js";

const event: AgentEvent = {
  id: "event-1",
  kind: "turn",
  ts: "2026-09-26T10:00:00Z",
  agent: "codex",
  sessionId: "s-1",
  usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 20, totalTokens: 20 },
  source: { file: "fixture.jsonl", line: 1 },
};

const commit: GitCommit = {
  hash: "b".repeat(40),
  shortHash: "bbbbbbb",
  authorName: "Test",
  authorEmail: "test@example.com",
  authoredAt: "2026-09-26T10:01:00Z",
  subject: "fix ledger [s-1]",
  additions: 12,
  deletions: 2,
  files: ["src/a.ts"],
  attribution: { sessionId: "s-1", agent: "codex", timeDeltaMs: 1000, confidence: "high", evidence: "session-id-in-subject" },
};

test("receipts form a verifiable hash chain", () => {
  const root = mkdtempSync(join(tmpdir(), "agentyield-receipts-"));
  try {
    const created = createReceipt([event], commit);
    const receipt = appendReceipt(root, created);
    writeReceipts(root, [receipt]);

    const stored = readReceipts(root);
    const result = verifyReceipts(stored);
    assert.equal(result.valid, true);
    assert.equal(result.checked, 1);
    assert.equal(stored[0].sessionId, "s-1");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("canonical JSON is stable and excludes hash", () => {
  assert.equal(canonicalJson({ b: 1, a: 2, hash: "ignored" }), '{"a":2,"b":1}');
});

test("verification detects changed hashes", () => {
  const created = createReceipt([event], commit);
  const receipt = appendReceipt(process.cwd(), created);
  assert.equal(verifyReceipts([receipt]).valid, true);
  assert.equal(verifyReceipts([{ ...receipt, metrics: { ...receipt.metrics, outputTokens: 999 } }]).valid, false);
});


