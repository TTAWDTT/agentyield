import { createHash } from "node:crypto";
import type { AgentEvent, GitCommit, YieldReceipt } from "./types.js";
import { readReceipts } from "./ledger.js";

const ZERO_HASH = "0".repeat(64);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).filter((key) => key !== "hash").sort();
    const result: Record<string, unknown> = {};
    for (const key of keys) result[key] = canonicalize(record[key]);
    return result;
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function hashReceipt(receipt: Omit<YieldReceipt, "hash">): string {
  return createHash("sha256").update(canonicalJson(receipt)).digest("hex");
}

export function createReceipt(events: AgentEvent[], commit: GitCommit, sessionId?: string): Omit<YieldReceipt, "hash"> {
  const attribution = commit.attribution;
  const resolvedSessionId = sessionId ?? attribution?.sessionId;
  if (!resolvedSessionId) {
    throw new Error("No session id available. Attribute the commit first or pass --session-id.");
  }
  const scoped = events.filter((event) => event.sessionId === resolvedSessionId);
  const metrics = {
    inputTokens: scoped.reduce((total, event) => total + (event.usage?.inputTokens ?? 0), 0),
    cachedInputTokens: scoped.reduce((total, event) => total + (event.usage?.cachedInputTokens ?? 0), 0),
    outputTokens: scoped.reduce((total, event) => total + (event.usage?.outputTokens ?? 0), 0),
    declaredCostUsd: scoped.reduce((total, event) => total + (event.usage?.costUsd ?? 0), 0),
    additions: commit.additions,
    deletions: commit.deletions,
  };
  const withoutHash = {
    id: `rcpt_${createHash("sha256").update(`${commit.hash}:${resolvedSessionId}`).digest("hex").slice(0, 20)}`,
    createdAt: new Date().toISOString(),
    agent: attribution?.agent ?? scoped[0]?.agent ?? "generic",
    sessionId: resolvedSessionId,
    commit: commit.hash,
    metrics,
    prevHash: ZERO_HASH,
  };
  return withoutHash;
}

export function appendReceipt(root: string, receipt: Omit<YieldReceipt, "hash">): YieldReceipt {
  const existing = readReceipts(root);
  const previousReceipt = existing.at(-1);
  const previousHash = previousReceipt ? previousReceipt.hash : ZERO_HASH;
  const staged: Omit<YieldReceipt, "hash"> = { ...receipt, prevHash: previousHash };
  const result: YieldReceipt = { ...staged, hash: hashReceipt(staged) };
  return result;
}

export function verifyReceipts(receipts: YieldReceipt[]): { valid: boolean; checked: number; problems: string[] } {
  const problems: string[] = [];
  let previousHash = ZERO_HASH;
  for (const [index, receipt] of receipts.entries()) {
    if (receipt.prevHash !== previousHash) {
      problems.push(`receipt ${index + 1} prevHash does not match the previous receipt`);
    }
    const expectedHash = hashReceipt(receipt);
    if (receipt.hash !== expectedHash) {
      problems.push(`receipt ${index + 1} hash is invalid`);
    }
    previousHash = receipt.hash;
  }
  return { valid: problems.length === 0, checked: receipts.length, problems };
}


