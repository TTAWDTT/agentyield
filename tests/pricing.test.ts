import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { estimateEventCost, loadPricing } from "../src/pricing.js";
import type { AgentEvent } from "../src/types.js";
import type { PricingConfig } from "../src/pricing.js";

const event = {
  id: "e1",
  kind: "turn",
  ts: "2026-09-26T10:00:00Z",
  agent: "codex",
  sessionId: "s1",
  model: "example",
  usage: { inputTokens: 1_000_000, cachedInputTokens: 500_000, outputTokens: 1_000, totalTokens: 1_501_000 },
  source: { file: "f", line: 1 },
} satisfies AgentEvent;

test("estimates cost only from the user-supplied pricing file", () => {
  const root = mkdtempSync(join(tmpdir(), "agentyield-pricing-"));
  try {
    const file = join(root, "pricing.json");
    writeFileSync(file, JSON.stringify({ version: 1, currency: "USD", models: { example: { inputPerMTokens: 1, cachedInputPerMTokens: 0.2, outputPerMTokens: 2 } } }));
    const pricing = loadPricing(file);
    assert.ok(pricing);
    assert.equal(estimateEventCost(event, pricing), 1.102);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("declared cost prevents estimated cost from being created", () => {
  const pricing: PricingConfig = { version: 1, currency: "USD", models: { example: { inputPerMTokens: 1 } } };
  const declared = { ...event, usage: { ...event.usage, costUsd: 0.02 } };
  assert.equal(estimateEventCost(declared, pricing), undefined);
});

test("rejects malformed pricing files", () => {
  const root = mkdtempSync(join(tmpdir(), "agentyield-pricing-bad-"));
  try {
    const file = join(root, "pricing.json");
    writeFileSync(file, JSON.stringify({ version: 1, currency: "EUR", models: {} }));
    assert.throws(() => loadPricing(file), /Invalid pricing file/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});



