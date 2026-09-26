import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AgentEvent, AgentName, EventKind, TokenUsage } from "./types.js";

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") return value;
  return undefined;
}

export function firstString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    if (key.includes(".")) {
      const parts = key.split(".");
      let cursor: unknown = record;
      for (const part of parts) {
        if (!isRecord(cursor)) return undefined;
        cursor = cursor[part];
      }
      const value = asString(cursor);
      if (value !== undefined) return value;
    } else {
      const value = asString(record[key]);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function firstNumber(record: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    if (key.includes(".")) {
      const parts = key.split(".");
      let cursor: unknown = record;
      for (const part of parts) {
        if (!isRecord(cursor)) return undefined;
        cursor = cursor[part];
      }
      const value = asNumber(cursor);
      if (value !== undefined) return value;
    } else {
      const value = asNumber(record[key]);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

export function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === "string" && value.trim() !== "") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return undefined;
}

export function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function contentToText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const chunks: string[] = [];
    for (const item of value) {
      if (typeof item === "string") {
        chunks.push(item);
      } else if (isRecord(item) && typeof item.text === "string") {
        chunks.push(item.text);
      } else if (isRecord(item) && isRecord(item.message) && typeof item.message.content === "string") {
        chunks.push(item.message.content);
      }
    }
    if (chunks.length > 0) return chunks.join("\n");
  }
  if (isRecord(value)) {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (typeof value.output_text === "string") return value.output_text;
  }
  return undefined;
}

function extractUsage(record: UnknownRecord): Omit<TokenUsage, "totalTokens"> | undefined {
  const direct = isRecord(record.usage) ? record.usage : undefined;
  const message = isRecord(record.message) ? record.message : undefined;
  const nested = message && isRecord(message.usage) ? message.usage : undefined;
  const response = isRecord(record.response) ? record.response : undefined;
  const responseUsage = response && isRecord(response.usage) ? response.usage : undefined;

  const sources = [direct, nested, responseUsage].filter(Boolean) as UnknownRecord[];
  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let costUsd: number | undefined;

  for (const source of sources) {
    inputTokens = inputTokens || asNumber(source.input_tokens) || asNumber(source.prompt_tokens) || asNumber(source.inputTokens) || 0;
    cachedInputTokens = cachedInputTokens || asNumber(source.cache_read_input_tokens) || asNumber(source.cachedInputTokens) || 0;
    outputTokens = outputTokens || asNumber(source.output_tokens) || asNumber(source.completion_tokens) || asNumber(source.outputTokens) || 0;
    costUsd = costUsd ?? asNumber(source.cost_usd) ?? asNumber(source.costUSD) ?? asNumber(source.cost);
  }

  costUsd = costUsd ?? asNumber(record.cost_usd) ?? asNumber(record.costUSD) ?? asNumber(record.cost);

  const promptText = contentToText(record.prompt) ?? (message ? contentToText(message.content) : undefined);
  const outputText = contentToText(record.output) ?? (response ? contentToText(response.output) : undefined);

  if (!inputTokens && promptText) inputTokens = estimateTokens(promptText);
  if (!outputTokens && outputText) outputTokens = estimateTokens(outputText);

  if (!inputTokens && !outputTokens && !cachedInputTokens && costUsd === undefined) return undefined;
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}

function classifyKind(record: UnknownRecord): EventKind {
  const type = firstString(record, ["type", "event", "kind"])?.toLowerCase() ?? "";
  if (type.includes("session")) return "session";
  if (type.includes("tool")) return "tool";
  if (type.includes("result") || type.includes("complete")) return "result";
  if (type.includes("assistant") || type.includes("user") || type.includes("turn") || type.includes("message")) return "turn";
  return "other";
}

function normalizeAgent(record: UnknownRecord): AgentName {
  const value = firstString(record, ["agent", "agent_name", "source"])?.toLowerCase();
  if (value === "claude" || value === "claude-code" || value === "claudecode") return "claude";
  if (value === "codex" || value === "openai-codex") return "codex";
  return "generic";
}

export function normalizeEvent(input: unknown, sourceFile: string, lineNumber: number): AgentEvent | null {
  if (!isRecord(input)) return null;
  const kind = classifyKind(input);
  const timestamp = normalizeTimestamp(input.ts ?? input.timestamp ?? input.created_at ?? input.createdAt);
  if (!timestamp) return null;
  const sessionId = firstString(input, ["session_id", "sessionId", "conversation_id", "conversationId"]);
  if (!sessionId) return null;

  const message = isRecord(input.message) ? input.message : undefined;
  const response = isRecord(input.response) ? input.response : undefined;
  const usage = extractUsage(input);
  const prompt = contentToText(input.prompt) ?? (message ? contentToText(message.content) : undefined);
  const output = contentToText(input.output) ??
    (response ? contentToText(response.output) : undefined) ??
    (message && message.role === "assistant" ? contentToText(message.content) : undefined);

  const event: AgentEvent = {
    id: createHash("sha256").update(`${sourceFile}:${lineNumber}:${JSON.stringify(input)}`).digest("hex").slice(0, 32),
    kind,
    ts: timestamp,
    agent: normalizeAgent(input),
    sessionId,
    source: { file: sourceFile, line: lineNumber },
  };

  const project = firstString(input, ["project", "project_path", "cwd"]);
  if (project) event.project = project;
  const model = firstString(input, ["model", "model_name"]) ?? (message ? firstString(message, ["model"]) : undefined) ?? (response ? firstString(response, ["model"]) : undefined);
  if (model) event.model = model;

  const toolName = firstString(input, ["tool_name", "toolName", "name"]);
  if (toolName) event.toolName = toolName;
  const duration = firstNumber(input, ["duration_ms", "durationMs", "tool_duration_ms"]);
  if (duration !== undefined) event.toolDurationMs = duration;
  if (typeof input.ok === "boolean") event.ok = input.ok;
  if (prompt) event.prompt = prompt;
  if (output) event.output = output;
  if (usage) event.usage = { ...usage, totalTokens: usage.inputTokens + usage.cachedInputTokens + usage.outputTokens };

  return event;
}

export function parseJsonlFile(filePath: string): AgentEvent[] {
  const text = readFileSync(filePath, "utf8");
  const events: AgentEvent[] = [];
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    try {
      const event = normalizeEvent(JSON.parse(trimmed), filePath, index + 1);
      if (event) events.push(event);
    } catch {
      // Invalid lines are ignored so a single malformed record cannot kill a long session import.
    }
  }
  return events;
}

export function normalizeAgentName(value: string): AgentName {
  const normalized = value.toLowerCase();
  if (normalized === "claude" || normalized === "claude-code") return "claude";
  if (normalized === "codex" || normalized === "openai-codex") return "codex";
  if (normalized === "generic" || normalized === "agentyield") return "generic";
  throw new Error(`Unsupported agent "${value}". Use claude, codex, or generic.`);
}

export function overrideAgent(events: AgentEvent[], agent: AgentName): AgentEvent[] {
  return events.map((event) => ({ ...event, agent }));
}





