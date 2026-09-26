import { estimateEventCost } from "./pricing.js";
import type { PricingConfig } from "./pricing.js";
import type { AgentEvent, GitCommit, SessionSummary, YieldReport } from "./types.js";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isoDaysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function sessionKey(event: AgentEvent): string {
  return `${event.agent}:${event.sessionId}`;
}

export function groupSessions(events: AgentEvent[]): Map<string, AgentEvent[]> {
  const map = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const key = sessionKey(event);
    const current = map.get(key);
    if (current) current.push(event);
    else map.set(key, [event]);
  }
  for (const rows of map.values()) rows.sort((a, b) => a.ts.localeCompare(b.ts));
  return map;
}

export function summarizeSession(sessionIdKey: string, events: AgentEvent[], commits: GitCommit[], pricing?: PricingConfig): SessionSummary {
  const [agent, sessionId] = sessionIdKey.split(":", 2) as [AgentEvent["agent"], string];
  const turns = events.filter((event) => event.kind === "turn").length;
  const tools = events.filter((event) => event.kind === "tool").length;
  const inputTokens = sum(events.map((event) => event.usage?.inputTokens ?? 0));
  const cachedInputTokens = sum(events.map((event) => event.usage?.cachedInputTokens ?? 0));
  const outputTokens = sum(events.map((event) => event.usage?.outputTokens ?? 0));
  const totalTokens = sum(events.map((event) => event.usage?.totalTokens ?? 0));
  const costUsd = sum(events.map((event) => event.usage?.costUsd ?? 0));
  const estimatedCostUsd = pricing ? sum(events.map((event) => estimateEventCost(event, pricing) ?? 0)) : 0;
  const sessionCommits = commits.filter((commit) => commit.attribution?.sessionId === sessionId && commit.attribution.agent === agent);
  const firstAt = events[0]?.ts ?? new Date(0).toISOString();
  const lastAt = events[events.length - 1]?.ts ?? firstAt;

  return {
    sessionId,
    agent,
    events: events.length,
    turns,
    tools,
    firstAt,
    lastAt,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    estimatedCostUsd,
    commits: sessionCommits.length,
    additions: sum(sessionCommits.map((commit) => commit.additions)),
    deletions: sum(sessionCommits.map((commit) => commit.deletions)),
    hasCostEvidence: costUsd > 0 || estimatedCostUsd > 0 || outputTokens > 0,
  };
}

export function buildReport(events: AgentEvent[], commits: GitCommit[], options: ReportOptions = {}): YieldReport {
  const days = Math.max(1, options.days ?? 30);
  const now = options.now ?? new Date();
  const cutoff = isoDaysAgo(days, now);
  const scoped = events.filter((event) => event.ts >= cutoff);
  const scopedCommits = commits.filter((commit) => commit.authoredAt >= cutoff);
  const sessionMap = groupSessions(scoped);
  const sessions = [...sessionMap.entries()].map(([key, rows]) => summarizeSession(key, rows, scopedCommits, options.pricing));
  const inputTokens = sum(sessions.map((session) => session.inputTokens));
  const cachedInputTokens = sum(sessions.map((session) => session.cachedInputTokens));
  const outputTokens = sum(sessions.map((session) => session.outputTokens));
  const totalTokens = sum(sessions.map((session) => session.totalTokens));
  const declaredCostUsd = sum(sessions.map((session) => session.costUsd));
  const estimatedCostUsd = sum(sessions.map((session) => session.estimatedCostUsd));
  const commitCount = scopedCommits.length;
  const additions = sum(scopedCommits.map((commit) => commit.additions));
  const deletions = sum(scopedCommits.map((commit) => commit.deletions));
  const zeroCommit = sessions
    .filter((session) => session.hasCostEvidence && session.commits === 0)
    .sort((a, b) => ((b.costUsd + b.estimatedCostUsd) - (a.costUsd + a.estimatedCostUsd)) || (b.outputTokens - a.outputTokens));
  const topSessions = [...sessions].sort((a, b) => (b.outputTokens - a.outputTokens) || (b.costUsd - a.costUsd)).slice(0, 10);

  return {
    generatedAt: now.toISOString(),
    days,
    sessions: sessions.length,
    events: scoped.length,
    turns: sum(sessions.map((session) => session.turns)),
    tools: sum(sessions.map((session) => session.tools)),
    inputTokens,
    cachedInputTokens,
    outputTokens,
    totalTokens,
    declaredCostUsd,
    estimatedCostUsd,
    commits: commitCount,
    additions,
    deletions,
    outputTokensPerCommit: commitCount > 0 ? round(outputTokens / commitCount) : 0,
    commitsPer1kOutputTokens: outputTokens > 0 ? round((commitCount * 1000) / outputTokens) : 0,
    sessionsWithZeroCommits: zeroCommit.slice(0, 20),
    topSessions,
    evidenceLimitations: [
      "Session-to-commit attribution uses session id in the commit subject or nearest event time within the configured window.",
      "Cost is reported only when the adapter supplies it; AgentYield does not invent provider pricing.",
      "Commit additions/deletions measure Git churn, not business value or code quality.",
    ],
  };
}

export interface ReportOptions {
  days?: number;
  now?: Date;
  redactText?: boolean;
  pricing?: PricingConfig;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function renderMarkdown(report: YieldReport): string {
  const lines: string[] = [];
  lines.push(`# AgentYield Report`);
  lines.push("");
  lines.push(`Generated: \`${report.generatedAt}\``);
  lines.push(`Window: last ${report.days} days`);
  lines.push("");
  lines.push("## Yield");
  lines.push("");
  lines.push(`- Sessions: ${report.sessions}`);
  lines.push(`- Events: ${report.events}`);
  lines.push(`- Commits: ${report.commits}`);
  lines.push(`- Input tokens: ${report.inputTokens.toLocaleString("en-US")}`);
  lines.push(`- Cached input tokens: ${report.cachedInputTokens.toLocaleString("en-US")}`);
  lines.push(`- Output tokens: ${report.outputTokens.toLocaleString("en-US")}`);
  lines.push(`- Output tokens / commit: ${report.outputTokensPerCommit.toLocaleString("en-US")}`);
  lines.push(`- Commits / 1,000 output tokens: ${report.commitsPer1kOutputTokens.toLocaleString("en-US")}`);
  lines.push(`- Declared cost: $${report.declaredCostUsd.toFixed(4)}`);
  lines.push(`- User-priced estimated cost: $${report.estimatedCostUsd.toFixed(4)}`);
  lines.push(`- Git additions: ${report.additions.toLocaleString("en-US")}`);
  lines.push(`- Git deletions: ${report.deletions.toLocaleString("en-US")}`);
  lines.push("");
  lines.push("## Sessions with zero linked commits");
  lines.push("");
  if (report.sessionsWithZeroCommits.length === 0) {
    lines.push("None with measurable output tokens or declared cost.");
  } else {
    for (const session of report.sessionsWithZeroCommits) {
      lines.push(`- \`${session.agent}:${session.sessionId}\` — ${session.outputTokens.toLocaleString("en-US")} output tokens, ${session.costUsd.toFixed(4)} declared, ${session.estimatedCostUsd.toFixed(4)} estimated.`);
    }
  }
  lines.push("");
  lines.push("## Top sessions by output");
  lines.push("");
  for (const session of report.topSessions) {
    lines.push(`- \`${session.agent}:${session.sessionId}\` — ${session.outputTokens.toLocaleString("en-US")} out / ${session.inputTokens.toLocaleString("en-US")} in / ${session.commits} commit(s)`);
  }
  lines.push("");
  lines.push("## Evidence limitations");
  lines.push("");
  for (const limitation of report.evidenceLimitations) lines.push(`- ${limitation}`);
  lines.push("");
  return lines.join("\n");
}

export function renderText(report: YieldReport): string {
  const lines = [
    `AgentYield Report (${report.days} days)`,
    `Sessions: ${report.sessions} | Events: ${report.events} | Commits: ${report.commits}`,
    `Tokens in: ${report.inputTokens} | cached: ${report.cachedInputTokens} | out: ${report.outputTokens}`,
    `Declared cost: $${report.declaredCostUsd.toFixed(4)} | estimated: $${report.estimatedCostUsd.toFixed(4)}`,
    `Yield: ${report.commitsPer1kOutputTokens} commits / 1,000 output tokens`,
    `Git churn: +${report.additions} / -${report.deletions}`,
    `Zero-commit sessions: ${report.sessionsWithZeroCommits.length}`,
    `Limitations: ${report.evidenceLimitations.length} documented in JSON/markdown report`,
  ];
  return lines.join("\n");
}





