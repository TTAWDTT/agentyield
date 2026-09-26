export type AgentName = "claude" | "codex" | "generic";

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd?: number;
}

export interface EventSource {
  file: string;
  line: number;
}

export type EventKind = "session" | "turn" | "tool" | "result" | "other";

export interface AgentEvent {
  id: string;
  kind: EventKind;
  ts: string;
  agent: AgentName;
  sessionId: string;
  project?: string;
  model?: string;
  toolName?: string;
  toolDurationMs?: number;
  ok?: boolean;
  prompt?: string;
  output?: string;
  usage?: TokenUsage;
  source: EventSource;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  subject: string;
  additions: number;
  deletions: number;
  files: string[];
  attribution?: CommitAttribution;
}

export interface CommitAttribution {
  sessionId: string;
  agent: AgentName;
  timeDeltaMs: number;
  confidence: "high" | "medium" | "low";
  evidence: "session-id-in-subject" | "nearest-event-time";
}

export interface SessionSummary {
  sessionId: string;
  agent: AgentName;
  events: number;
  turns: number;
  tools: number;
  firstAt: string;
  lastAt: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  estimatedCostUsd: number;
  commits: number;
  additions: number;
  deletions: number;
  hasCostEvidence: boolean;
}

export interface YieldReport {
  generatedAt: string;
  days: number;
  sessions: number;
  events: number;
  turns: number;
  tools: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  declaredCostUsd: number;
  estimatedCostUsd: number;
  commits: number;
  additions: number;
  deletions: number;
  outputTokensPerCommit: number;
  commitsPer1kOutputTokens: number;
  sessionsWithZeroCommits: SessionSummary[];
  topSessions: SessionSummary[];
  evidenceLimitations: string[];
}

export interface YieldReceipt {
  id: string;
  createdAt: string;
  agent: AgentName;
  sessionId: string;
  commit: string;
  metrics: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    declaredCostUsd: number;
    additions: number;
    deletions: number;
  };
  prevHash: string;
  hash: string;
}

export interface LedgerConfig {
  version: 1;
  attributionWindowMinutes: number;
  privacyMode: "full" | "redact-text";
}




