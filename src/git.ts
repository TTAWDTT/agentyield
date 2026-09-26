import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { AgentEvent, CommitAttribution, GitCommit } from "./types.js";

export function listCommits(repoPath: string = process.cwd(), sinceDays: number = 30): GitCommit[] {
  const cwd = resolve(repoPath);
  if (!existsSync(resolve(cwd, ".git"))) {
    throw new Error(`Not a Git repository: ${cwd}`);
  }
  const format = "%x00%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x00";
  const result = spawnSync("git", [
    "log",
    `--since=${sinceDays}.days.ago`,
    "--date=iso-strict",
    "--numstat",
    `--pretty=format:${format}`,
  ], { cwd, encoding: "utf8", maxBuffer: 1024 * 1024 * 32 });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git log failed with exit code ${result.status}`);
  }

  const output = result.stdout ?? "";
  const commits: GitCommit[] = [];
  for (const rawRecord of output.split("\u0000")) {
    if (!rawRecord.trim()) continue;
    const lines = rawRecord.split(/\r?\n/).filter((line) => line.trim() !== "");
    if (lines.length === 0) continue;
    const fields = lines[0].split("\x1f");
    if (fields.length < 6) continue;
    const files: string[] = [];
    let additions = 0;
    let deletions = 0;
    for (const line of lines.slice(1)) {
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      const [add, del, path] = parts;
      if (add !== "-") additions += Number(add) || 0;
      if (del !== "-") deletions += Number(del) || 0;
      files.push(path);
    }
    commits.push({
      hash: fields[0],
      shortHash: fields[1],
      authorName: fields[2],
      authorEmail: fields[3],
      authoredAt: fields[4],
      subject: fields[5],
      additions,
      deletions,
      files,
    });
  }
  return commits.sort((a, b) => a.authoredAt.localeCompare(b.authoredAt));
}

function subjectContainsSessionId(commit: GitCommit, sessionId: string): boolean {
  return commit.subject.toLowerCase().includes(sessionId.toLowerCase());
}

function timeDeltaMs(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime());
}

export function attributeCommits(events: AgentEvent[], commits: GitCommit[], windowMinutes: number = 30): GitCommit[] {
  const windowMs = Math.max(0, windowMinutes) * 60 * 1000;
  const candidateEvents = events.filter((event) => event.kind === "session" || event.kind === "turn" || event.kind === "result");
  return commits.map((commit) => {
    const inWindow = candidateEvents
      .map((event) => ({ event, delta: timeDeltaMs(commit.authoredAt, event.ts) }))
      .filter((candidate) => candidate.delta <= windowMs)
      .sort((a, b) => a.delta - b.delta);
    if (inWindow.length === 0) return commit;
    const exact = inWindow.find((candidate) => subjectContainsSessionId(commit, candidate.event.sessionId));
    if (exact) {
      const attribution: CommitAttribution = {
        sessionId: exact.event.sessionId,
        agent: exact.event.agent,
        timeDeltaMs: exact.delta,
        confidence: "high",
        evidence: "session-id-in-subject",
      };
      return { ...commit, attribution };
    }
    const nearest = inWindow[0];
    const attribution: CommitAttribution = {
      sessionId: nearest.event.sessionId,
      agent: nearest.event.agent,
      timeDeltaMs: nearest.delta,
      confidence: nearest.delta <= 5 * 60 * 1000 ? "medium" : "low",
      evidence: "nearest-event-time",
    };
    return { ...commit, attribution };
  });
}
