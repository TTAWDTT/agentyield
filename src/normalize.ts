import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AgentEvent, AgentName, EventKind, TokenUsage } from "./types.js";

type UnknownRecord = Record<string, unknown>;

export interface ParseState {
  sessionId?: string;
  project?: string;
  model?: string;
}

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
    return new Date(value > 1_000_000_000_000 ? value : value * 1000).toISOString();
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
        continue;
      }
      if (!isRecord(item)) continue;
      const candidates = [item.text, item.input_text, item.output_text];
      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim() !== "") chunks.push(candidate);
      }
    }
    return chunks.length > 0 ? chunks.join("\n") : undefined;
  }
  if (isRecord(value)) {
    const candidates = [value.text, value.input_text, value.output_text, value.output_text];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
    }
    if (isRecord(value.message) && typeof value.message.content === "string") return value.message.content;
  }
  return undefined;
}

function extractUsage(record: UnknownRecord): Omit<TokenUsage, "totalTokens"> | undefined {
  const direct = isRecord(record.usage) ? record.usage : undefined;
  const message = isRecord(record.message) ? record.message : undefined;
  const messageUsage = message && isRecord(message.usage) ? message.usage : undefined;
  const response = isRecord(record.response) ? record.response : undefined;
  const responseUsage = response && isRecord(response.usage) ? response.usage : undefined;
  const payload = isRecord(record.payload) ? record.payload : undefined;
  const payloadInfo = payload && isRecord(payload.info) ? payload.info : undefined;
  const lastUsage = payloadInfo && isRecord(payloadInfo.last_token_usage) ? payloadInfo.last_token_usage : undefined;
  const totalUsage = payloadInfo && isRecord(payloadInfo.total_token_usage) ? payloadInfo.total_token_usage : undefined;

  const usageSource = lastUsage ?? direct ?? messageUsage ?? responseUsage ?? totalUsage;

  let inputTokens = 0;
  let cachedInputTokens = 0;
  let outputTokens = 0;
  let costUsd: number | undefined;

  if (usageSource) {
    inputTokens = asNumber(usageSource.input_tokens) ?? asNumber(usageSource.prompt_tokens) ?? asNumber(usageSource.inputTokens) ?? 0;
    cachedInputTokens = asNumber(usageSource.cache_read_input_tokens) ?? asNumber(usageSource.cached_input_tokens) ?? asNumber(usageSource.cachedInputTokens) ?? 0;
    outputTokens = asNumber(usageSource.output_tokens) ?? asNumber(usageSource.completion_tokens) ?? asNumber(usageSource.outputTokens) ?? 0;
    costUsd = asNumber(usageSource.cost_usd) ?? asNumber(usageSource.costUSD) ?? asNumber(usageSource.cost);
  }

  costUsd = costUsd ?? asNumber(record.cost_usd) ?? asNumber(record.costUSD) ?? asNumber(record.cost);

  const promptText = contentToText(record.prompt) ?? (message ? contentToText(message.content) : undefined);
  const outputText = contentToText(record.output) ??
    (response ? contentToText(response.output) : undefined) ??
    (message ? contentToText(message.content) : undefined);

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

function hasToolContent(record: UnknownRecord): boolean {
  const message = isRecord(record.message) ? record.message : undefined;
  const payload = isRecord(record.payload) ? record.payload : undefined;
  const content = message?.content ?? payload?.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => isRecord(item) && ["tool_use", "tool_result", "function_call", "function_call_output"].includes(String(item.type)));
}

function classifyKind(record: UnknownRecord): EventKind {
  const type = firstString(record, ["type", "event", "kind"])?.toLowerCase() ?? "";
  const payload = isRecord(record.payload) ? record.payload : undefined;
  const payloadType = firstString(payload ?? {}, ["type"])?.toLowerCase() ?? "";
  if (type === "session_meta" || type.includes("session")) return "session";
  if (type === "response_item" && ["function_call", "function_call_output"].includes(payloadType)) return "tool";
  if (type === "event_msg" && payloadType.includes("tool")) return "tool";
  if (type === "event_msg" && payloadType.includes("token")) return "turn";
  if (hasToolContent(record)) return "tool";
  if (type.includes("tool")) return "tool";
  if (type.includes("result") || type.includes("complete")) return "result";
  if (type.includes("assistant") || type.includes("user") || type.includes("message") || type.includes("turn")) return "turn";
  if (hasToolContent(record)) return "tool";
  return "other";
}

function toolName(record: UnknownRecord): string | undefined {
  const message = isRecord(record.message) ? record.message : undefined;
  const content = message?.content ?? (isRecord(record.payload) ? record.payload.content : undefined);
  if (Array.isArray(content)) {
    const toolItem = content.find((item) => isRecord(item) && typeof item.name === "string");
    if (toolItem && typeof toolItem.name === "string") return toolItem.name;
  }
  const payload = isRecord(record.payload) ? record.payload : undefined;
  return firstString(record, ["tool_name", "toolName", "name"]) ??
    (payload ? firstString(payload, ["name"]) : undefined) ??
    (payload && isRecord(payload.invocation) ? firstString(payload.invocation, ["tool"]) : undefined);
}

function durationMs(record: UnknownRecord): number | undefined {
  const payload = isRecord(record.payload) ? record.payload : undefined;
  const duration = payload && isRecord(payload.duration) ? payload.duration : undefined;
  if (duration) {
    const seconds = asNumber(duration.secs) ?? 0;
    const nanos = asNumber(duration.nanos) ?? 0;
    return Math.round(seconds * 1000 + nanos / 1_000_000);
  }
  return firstNumber(record, ["duration_ms", "durationMs", "tool_duration_ms"]);
}

function ok(record: UnknownRecord): boolean | undefined {
  if (typeof record.ok === "boolean") return record.ok;
  const payload = isRecord(record.payload) ? record.payload : undefined;
  if (payload && isRecord(payload.result) && typeof payload.result.isError === "boolean") {
    return !payload.result.isError;
  }
  return undefined;
}

export function normalizeEvent(input: unknown, sourceFile: string, lineNumber: number, state: ParseState = {}): AgentEvent | null {
  if (!isRecord(input)) return null;
  const payload = isRecord(input.payload) ? input.payload : undefined;
  const response = isRecord(input.response) ? input.response : undefined;
  const message = isRecord(input.message) ? input.message : undefined;

  const timestamp = normalizeTimestamp(
    input.ts ?? input.timestamp ?? input.created_at ?? input.createdAt ?? payload?.timestamp,
  );
  if (!timestamp) return null;

  let sessionId = firstString(input, ["session_id", "sessionId", "conversation_id", "conversationId"]);
  if (!sessionId && firstString(input, ["type", "event", "kind"]) === "session_meta" && payload) sessionId = firstString(payload, ["id", "session_id", "sessionId"]);
  if (!sessionId && state.sessionId) sessionId = state.sessionId;
  if (!sessionId) return null;
  state.sessionId = sessionId;

  let project = firstString(input, ["project", "project_path", "cwd"]);
  if (!project && payload) project = firstString(payload, ["cwd", "project", "project_path"]);
  if (!project && state.project) project = state.project;
  if (project) state.project = project;

  let model = firstString(input, ["model", "model_name"]) ??
    (isRecord(input.message) ? firstString(input.message, ["model"]) : undefined) ??
    (payload ? firstString(payload, ["model"]) : undefined) ??
    (response ? firstString(response, ["model"]) : undefined) ??
    state.model;
  if (model) state.model = model;

  const kind = classifyKind(input);
  const usage = extractUsage(input);
  const event: AgentEvent = {
    id: createHash("sha256").update(`${sourceFile}:${lineNumber}:${JSON.stringify(input)}`).digest("hex").slice(0, 32),
    kind,
    ts: timestamp,
    agent: normalizeAgent(input),
    sessionId,
    source: { file: sourceFile, line: lineNumber },
  };

  if (project) event.project = project;
  if (model) event.model = model;
  const resolvedToolName = classifyKind(input) === "tool" ? toolName(input) : undefined;
  if (resolvedToolName) event.toolName = resolvedToolName;
  const eventDuration = classifyKind(input) === "tool" ? durationMs(input) : undefined;
  if (eventDuration !== undefined) event.toolDurationMs = eventDuration;
  const eventOk = classifyKind(input) === "tool" ? ok(input) : undefined;
  if (eventOk !== undefined) event.ok = eventOk;

  const promptText = contentToText(input.prompt) ??
    (isRecord(input.message) ? contentToText(input.message.content) : undefined) ??
    (payload ? contentToText(payload.content) : undefined);
  if (promptText) event.prompt = promptText;

  const outputText = contentToText(input.output) ??
    (isRecord(input.response) ? contentToText(input.response.output) : undefined) ??
    (isRecord(input.message) && input.message.role === "assistant" ? contentToText(input.message.content) : undefined);
  if (outputText) event.output = outputText;

  if (usage) event.usage = { ...usage, totalTokens: usage.inputTokens + usage.cachedInputTokens + usage.outputTokens };
  return event;
}

function normalizeAgent(record: UnknownRecord): AgentName {
  const value = firstString(record, ["agent", "agent_name", "source"])?.toLowerCase();
  if (value === "claude" || value === "claude-code") return "claude";
  if (value === "codex" || value === "openai-codex") return "codex";
  return "generic";
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

export function parseJsonlFile(filePath: string): AgentEvent[] {
  const text = readFileSync(filePath, "utf8");
  const events: AgentEvent[] = [];
  const state: ParseState = {};
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    try {
      const event = normalizeEvent(JSON.parse(trimmed), filePath, index + 1, state);
      if (event) events.push(event);
    } catch {
      // Skip malformed lines; agent logs often include summaries and non-event metadata.
    }
  }
  return events;
}




