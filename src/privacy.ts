import type { AgentEvent, LedgerConfig } from "./types.js";

export function redactEvents(events: AgentEvent[]): AgentEvent[] {
  return events.map((event) => {
    const next: AgentEvent = { ...event };
    delete next.prompt;
    delete next.output;
    return next;
  });
}

export function privacyModeFromValue(value: unknown): LedgerConfig["privacyMode"] {
  if (value === true || value === "redact-text" || value === "redact") return "redact-text";
  if (value === undefined || value === "full") return "full";
  throw new Error('Unsupported privacy mode. Use "full" or "redact-text".');
}


