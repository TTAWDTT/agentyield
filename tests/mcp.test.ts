import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handleMcpRequest } from "../src/mcp.js";
import { initLedger, appendEvents } from "../src/ledger.js";
import type { AgentEvent } from "../src/types.js";

function event(): AgentEvent {
  return {
    id: "mcp-1",
    kind: "turn",
    ts: "2026-09-26T10:00:00Z",
    agent: "codex",
    sessionId: "mcp-1",
    usage: { inputTokens: 100, cachedInputTokens: 0, outputTokens: 20, totalTokens: 120 },
    source: { file: "fixture.jsonl", line: 1 },
  };
}

test("MCP server initializes and lists tools", () => {
  const init = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
  const initData = init?.result as { serverInfo?: { name?: string } };
  assert.equal(initData.serverInfo?.name, "agentyield");

  const list = handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const listData = list?.result as { tools?: Array<{ name: string }> };
  const tools = listData.tools ?? [];
  assert.equal(tools.some((tool) => tool.name === "agentyield_report"), true);
});

test("MCP server returns a local report tool result", () => {
  const root = mkdtempSync(join(tmpdir(), "agentyield-mcp-"));
  try {
    initLedger(root);
    appendEvents(root, [event()]);
    const response = handleMcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "agentyield_report", arguments: { days: 30 } },
    }, { root });
    const result = response?.result as { isError?: boolean; structuredContent?: { generatedAt?: string } };
    assert.equal(result.isError, false);
    assert.match(result.structuredContent?.generatedAt ?? "", /T/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unknown MCP methods return protocol errors", () => {
  const response = handleMcpRequest({ jsonrpc: "2.0", id: 4, method: "nope" });
  assert.equal(response?.error?.code, -32601);
});
