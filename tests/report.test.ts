import assert from "node:assert/strict";
import test from "node:test";
import { buildReport, summarizeSession, groupSessions } from "../src/report.js";
import type { AgentEvent, GitCommit } from "../src/types.js";

const now = new Date("2026-09-26T12:00:00Z");

function event(sessionId: string, outputTokens: number, kind: AgentEvent["kind"] = "turn"): AgentEvent {
  return {
    id: sessionId + outputTokens + kind,
    kind,
    ts: "2026-09-26T10:00:00Z",
    agent: "codex",
    sessionId,
    usage: { inputTokens: 200, cachedInputTokens: 20, outputTokens, totalTokens: 220 + outputTokens, costUsd: 0.5 },
    source: { file: "fixture.jsonl", line: 1 },
  };
}

function eventNoUsage(sessionId: string): AgentEvent {
  return {
    id: sessionId,
    kind: "turn",
    ts: "2026-09-26T10:00:00Z",
    agent: "codex",
    sessionId,
    source: { file: "fixture.jsonl", line: 1 },
  };
}

const attributedCommit: GitCommit = {
  hash: "a".repeat(40),
  shortHash: "aaaaaaa",
  authorName: "Test",
  authorEmail: "test@example.com",
  authoredAt: "2026-09-26T10:01:00Z",
  subject: "feat: example",
  additions: 40,
  deletions: 5,
  files: ["src/a.ts"],
  attribution: { sessionId: "s1", agent: "claude", timeDeltaMs: 60_000, confidence: "medium", evidence: "nearest-event-time" },
};

test("buildReport joins agent sessions with attributed commits", () => {
  const report = buildReport([event("s1", 100), event("s2", 300)], [attributedCommit], { days: 7, now });
  assert.equal(report.days, 7);
  assert.equal(report.sessions, 2);
  assert.equal(report.outputTokens, 400);
  assert.equal(report.declaredCostUsd, 1);
  assert.equal(report.commits, 1);
  assert.equal(report.commitsPer1kOutputTokens, 2.5);
  assert.equal(report.topSessions[0]?.sessionId, "s2");
  assert.equal(report.evidenceLimitations.length > 0, true);
});

test("sessions without cost evidence are excluded from zero-commit warnings", () => {
  const report = buildReport([event("productive", 100), eventNoUsage("empty")], [], { days: 7, now });
  assert.equal(report.sessionsWithZeroCommits.length, 1);
  assert.equal(report.sessionsWithZeroCommits[0]?.sessionId, "productive");
});

test("session summary groups commits by agent and session", () => {
  const grouped = groupSessions([event("s1", 10)]);
  const summary = summarizeSession("claude:s1", grouped.get("claude:s1") ?? [], [attributedCommit]);
  assert.equal(summary.sessionId, "s1");
  assert.equal(summary.commits, 1);
});

