import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentEvent, GitCommit, LedgerConfig, YieldReceipt } from "./types.js";
import { isRecord } from "./normalize.js";

export interface LedgerPaths {
  root: string;
  ledgerDir: string;
  configPath: string;
  eventsPath: string;
  commitsPath: string;
  receiptsPath: string;
}

export function ledgerPaths(root: string = process.cwd()): LedgerPaths {
  const ledgerDir = join(root, ".agentyield");
  return {
    root,
    ledgerDir,
    configPath: join(ledgerDir, "config.json"),
    eventsPath: join(ledgerDir, "events.jsonl"),
    commitsPath: join(ledgerDir, "commits.json"),
    receiptsPath: join(ledgerDir, "receipts.jsonl"),
  };
}

export function initLedger(root: string, options: { privacyMode?: LedgerConfig["privacyMode"] } = {}): LedgerConfig {
  const paths = ledgerPaths(root);
  if (!existsSync(paths.ledgerDir)) mkdirSync(paths.ledgerDir, { recursive: true });
  const defaults: LedgerConfig = {
    version: 1,
    attributionWindowMinutes: 30,
    privacyMode: "full",
  };
  let config: LedgerConfig = defaults;
  if (existsSync(paths.configPath)) {
    config = readConfig(root);
  }
  if (options.privacyMode) config = { ...config, privacyMode: options.privacyMode };
  if (!existsSync(paths.configPath) || options.privacyMode) {
    writeFileSync(paths.configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  }
  return config;
}

export function readConfig(root: string): LedgerConfig {
  const paths = ledgerPaths(root);
  if (!existsSync(paths.configPath)) {
    throw new Error(`No ledger found at ${paths.ledgerDir}. Run "agentyield init" first.`);
  }
  const parsed: unknown = JSON.parse(readFileSync(paths.configPath, "utf8"));
  if (!isRecord(parsed) || parsed.version !== 1) {
    throw new Error("Unsupported .agentyield/config.json. Expected version 1.");
  }
  return {
    version: 1,
    attributionWindowMinutes: typeof parsed.attributionWindowMinutes === "number" ? parsed.attributionWindowMinutes : 30,
    privacyMode: parsed.privacyMode === "redact-text" ? "redact-text" : "full",
  };
}

export function readJsonLines<T>(filePath: string): T[] {
  if (!existsSync(filePath)) return [];
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.trim() !== "");
  return lines.map((line) => JSON.parse(line) as T);
}

export function writeJsonLines<T>(filePath: string, rows: T[]): void {
  const content = rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length > 0 ? "\n" : "");
  writeFileSync(filePath, content, "utf8");
}

export function appendEvents(root: string, incoming: AgentEvent[]): { added: number; duplicates: number } {
  const paths = ledgerPaths(root);
  if (!existsSync(paths.ledgerDir)) initLedger(root);
  const existing = readJsonLines<AgentEvent>(paths.eventsPath);
  const seen = new Set(existing.map((event) => event.id));
  const merged = [...existing];
  let added = 0;
  let duplicates = 0;
  for (const event of incoming) {
    if (seen.has(event.id)) {
      duplicates += 1;
      continue;
    }
    seen.add(event.id);
    merged.push(event);
    added += 1;
  }
  merged.sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id));
  writeJsonLines(paths.eventsPath, merged);
  return { added, duplicates };
}

export function readEvents(root: string): AgentEvent[] {
  return readJsonLines<AgentEvent>(ledgerPaths(root).eventsPath);
}

export function writeCommits(root: string, commits: GitCommit[]): void {
  const paths = ledgerPaths(root);
  if (!existsSync(paths.ledgerDir)) initLedger(root);
  writeFileSync(paths.commitsPath, JSON.stringify(commits, null, 2) + "\n", "utf8");
}

export function readCommits(root: string): GitCommit[] {
  const paths = ledgerPaths(root);
  if (!existsSync(paths.commitsPath)) return [];
  return JSON.parse(readFileSync(paths.commitsPath, "utf8")) as GitCommit[];
}

export function readReceipts(root: string): YieldReceipt[] {
  return readJsonLines<YieldReceipt>(ledgerPaths(root).receiptsPath);
}

export function writeReceipts(root: string, receipts: YieldReceipt[]): void {
  const paths = ledgerPaths(root);
  if (!existsSync(paths.ledgerDir)) initLedger(root);
  writeJsonLines(paths.receiptsPath, receipts);
}
