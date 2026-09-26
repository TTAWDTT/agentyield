import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { readCommits, readEvents, readReceipts } from "./ledger.js";
import { buildReport, renderText } from "./report.js";
import { loadPricing } from "./pricing.js";
import type { PricingConfig } from "./pricing.js";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpServerOptions {
  root?: string;
  days?: number;
  pricing?: PricingConfig;
}

export const MCP_PROTOCOL_VERSION = "2025-06-18";

export const MCP_TOOLS: McpTool[] = [
  {
    name: "agentyield_report",
    description: "Build the local AgentYield report for the selected ledger.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", minimum: 1 },
        pricing: { type: "string" },
      },
    },
  },
  {
    name: "agentyield_sessions",
    description: "List normalized local agent sessions with token and commit evidence.",
    inputSchema: {
      type: "object",
      properties: { days: { type: "number", minimum: 1 } },
    },
  },
  {
    name: "agentyield_receipts",
    description: "List hash-chained receipts in the selected local ledger.",
    inputSchema: { type: "object", properties: {} },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ok(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function error(id: JsonRpcRequest["id"], code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function textResult(data: unknown): unknown {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    isError: false,
  };
}

export function handleMcpRequest(request: unknown, options: McpServerOptions = {}): JsonRpcResponse | null {
  const root = resolve(options.root ?? process.cwd());
  if (!isRecord(request) || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return error(null, -32600, "Invalid Request");
  }
  const id = typeof request.id === "string" || typeof request.id === "number" ? request.id : null;
  const method = request.method;
  const params = isRecord(request.params) ? request.params : {};

  if (method === "notifications/initialized") return null;
  if (method === "initialize") {
    return ok(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "agentyield", version: "0.2.0" },
    });
  }
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: MCP_TOOLS });

  if (method === "tools/call") {
    const args = isRecord(params.arguments) ? params.arguments : {};
    const name = typeof params.name === "string" ? params.name : "";
    try {
      if (name === "agentyield_report") {
        const days = typeof args.days === "number" && args.days > 0 ? args.days : 30;
        const pricing = typeof args.pricing === "string" ? loadPricing(resolve(args.pricing)) : undefined;
        const report = buildReport(readEvents(root), readCommits(root), { days, pricing });
        return ok(id, {
          content: [{ type: "text", text: renderText(report) }],
          structuredContent: report,
          isError: false,
        });
      }
      if (name === "agentyield_sessions") {
        const days = typeof args.days === "number" && args.days > 0 ? args.days : options.days ?? 30;
        const report = buildReport(readEvents(root), readCommits(root), { days, pricing: options.pricing });
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(report.topSessions, null, 2) }],
          isError: false,
        });
      }
      if (name === "agentyield_receipts") {
        const receipts = readReceipts(root);
        return ok(id, {
          content: [{ type: "text", text: JSON.stringify(receipts, null, 2) }],
          isError: false,
        });
      }
      return error(id, -32602, `Unknown tool: ${name}`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      return ok(id, {
        content: [{ type: "text", text: message }],
        isError: true,
      });
    }
  }

  return error(id, -32601, `Method not found: ${method}`);
}

export async function startMcpServer(options: McpServerOptions = {}): Promise<void> {
  const root = resolve(options.root ?? process.cwd());
  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const request: unknown = JSON.parse(trimmed);
      const response = handleMcpRequest(request, { root, days: options.days, pricing: options.pricing });
      if (response) process.stdout.write(JSON.stringify(response) + "\n");
    } catch {
      process.stdout.write(JSON.stringify(error(null, -32700, "Parse error")) + "\n");
    }
  }
}



