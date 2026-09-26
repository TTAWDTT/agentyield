#!/usr/bin/env node
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { initLedger, ledgerPaths, readCommits, readConfig, readEvents, readReceipts, writeCommits, writeReceipts, appendEvents } from "./ledger.js";
import { normalizeAgentName, overrideAgent, parseJsonlFile } from "./normalize.js";
import { buildReport, renderMarkdown, renderText } from "./report.js";
import { attributeCommits, listCommits } from "./git.js";
import { appendReceipt, createReceipt, verifyReceipts } from "./receipt.js";
import { startDashboard } from "./dashboard.js";
import { discoverLocalFiles, defaultLogDirectory, formatBytes } from "./discover.js";
import { privacyModeFromValue, redactEvents } from "./privacy.js";
import { loadPricing } from "./pricing.js";

type Args = Record<string, string | boolean | string[]>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const command = argv[0] ?? "help";
  const args: Args = {};
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      if (!args.positional) args.positional = token;
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return { command, args };
}

function numberArg(args: Args, key: string, fallback: number): number {
  const value = args[key];
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function rootArg(args: Args): string {
  const value = args.root;
  return typeof value === "string" ? resolve(value) : process.cwd();
}

function optionValue(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required --${name} <value>`);
  }
  return value;
}

function walkJsonl(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const result: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walkJsonl(child));
    else if (entry.isFile() && extname(entry.name) === ".jsonl") result.push(child);
  }
  return result;
}

function printHelp(): void {
  console.log(`AgentYield — local-first ROI and evidence ledger for AI coding agents

Usage:
  agentyield <command> [options]

Commands:
  init [--privacy redact-text] Create a .agentyield ledger
  doctor                       Count likely local agent logs
  discover --agent codex       List local agent JSONL files without parsing
  ingest --agent claude --file <path>
  ingest --agent codex --auto  Ingest recent local Claude/Codex logs
  git --days 30                Read local Git history and attribute commits
  report --days 30 [--json|--markdown] [--pricing <file>]
  receipt --commit <sha> [--session-id <id>]
  verify                       Verify the receipt hash chain
  dashboard --port 4173        Open the local dashboard
  help                         Show this help

Common options:
  --root <dir>                 Project root (defaults to cwd)
  --days <n>                   History window
`);
}

function countCandidateLogs(): void {
  const home = homedir();
  const candidates = [
    { name: "Claude Code", directory: join(home, ".claude", "projects") },
    { name: "Codex CLI", directory: join(home, ".codex", "sessions") },
  ];
  for (const candidate of candidates) {
    const files = walkJsonl(candidate.directory);
    console.log(`${candidate.name}: ${files.length} JSONL file(s)`);
    console.log(`  path: ${candidate.directory}`);
  }
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));
  const root = rootArg(args);

  if (command === "init") {
    const config = initLedger(root, { privacyMode: privacyModeFromValue(args.privacy) });
    console.log(`Privacy mode: ${config.privacyMode}`);
    console.log(`Initialized AgentYield ledger at ${ledgerPaths(root).ledgerDir}`);
    console.log(`Attribution window: ${config.attributionWindowMinutes} minutes`);
    return;
  }

  if (command === "doctor") {
    countCandidateLogs();
    return;
  }

  if (command === "discover") {
    const agent = normalizeAgentName(optionValue(args.agent, "agent"));
    const files = discoverLocalFiles(agent, {
      sourceDir: typeof args["source-dir"] === "string" ? resolve(args["source-dir"]) : undefined,
      days: numberArg(args, "days", 7),
      limit: numberArg(args, "limit", 100),
      home: typeof args.home === "string" ? args.home : undefined,
    });
    const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
    console.log(`${agent}: ${files.length} recent JSONL file(s), ${formatBytes(totalBytes)}`);
    if (!files.length) {
      const expected = defaultLogDirectory(agent);
      if (expected) console.log(`Expected default directory: ${expected}`);
    }
    return;
  }

  if (command === "ingest") {
    const agent = normalizeAgentName(optionValue(args.agent, "agent"));
    if (args.auto === true) {
      if (agent === "generic") throw new Error("Auto-discovery requires claude or codex.");
      const files = discoverLocalFiles(agent, {
        sourceDir: typeof args["source-dir"] === "string" ? resolve(args["source-dir"]) : undefined,
        days: numberArg(args, "days", 7),
        limit: numberArg(args, "limit", 100),
        home: typeof args.home === "string" ? args.home : undefined,
      });
      if (args["dry-run"] === true) {
        for (const file of files) console.log(`${file.modifiedAt}  ${formatBytes(file.sizeBytes)}  ${file.path}`);
        console.log(`Dry run: ${files.length} file(s) would be parsed.`);
        return;
      }
      const parsed = overrideAgent(files.flatMap((file) => parseJsonlFile(file.path)), agent);
      const privacyMode = readConfig(root).privacyMode;
      const prepared = privacyMode === "redact-text" ? redactEvents(parsed) : parsed;
      const result = appendEvents(root, prepared);
      console.log(`Auto-ingested ${result.added} event(s) from ${files.length} file(s) (${result.duplicates} duplicate(s)).`);
      return;
    }
    const fileArg = optionValue(args.file, "file");
    const file = resolve(fileArg);
    if (!existsSync(file)) throw new Error(`File not found: ${file}`);
    const config = readConfig(root);
    const parsed = privacyModeFromValue(config.privacyMode) === "redact-text"
      ? redactEvents(overrideAgent(parseJsonlFile(file), agent))
      : overrideAgent(parseJsonlFile(file), agent);
    const result = appendEvents(root, parsed);
    console.log(`Ingested ${result.added} event(s) from ${basename(file)} (${result.duplicates} duplicate(s)).`);
    return;
  }

  if (command === "git") {
    const config = readConfig(root);
    const days = numberArg(args, "days", 30);
    const commits = listCommits(root, days);
    const attributed = attributeCommits(readEvents(root), commits, config.attributionWindowMinutes);
    writeCommits(root, attributed);
    const linked = attributed.filter((commit) => commit.attribution).length;
    console.log(`Loaded ${attributed.length} commit(s) from the last ${days} day(s). Linked ${linked} to an agent session.`);
    return;
  }

  if (command === "report") {
    const events = readEvents(root);
    const commits = readCommits(root);
    const days = numberArg(args, "days", 30);
    const pricingPath = typeof args.pricing === "string" ? resolve(args.pricing) : undefined;
    const pricing = pricingPath ? loadPricing(pricingPath) : undefined;
    const report = buildReport(events, commits, { days, pricing });
    writeFileSync(ledgerPaths(root).configPath.replace("config.json", "latest-report.json"), JSON.stringify(report, null, 2) + "\n", "utf8");
    if (args.json === true) {
      console.log(JSON.stringify(report, null, 2));
    } else if (args.markdown === true || args.md === true) {
      console.log(renderMarkdown(report));
    } else {
      console.log(renderText(report));
    }
    return;
  }

  if (command === "receipt") {
    const commitPrefix = optionValue(args.commit, "commit");
    const events = readEvents(root);
    const commits = readCommits(root);
    const commit = commits.find((item) => item.hash.startsWith(commitPrefix) || item.shortHash.startsWith(commitPrefix));
    if (!commit) throw new Error(`Commit not found in ledger: ${commitPrefix}`);
    const sessionId = typeof args["session-id"] === "string" ? args["session-id"] : undefined;
    const created = createReceipt(events, commit, sessionId);
    const receipts = readReceipts(root);
    if (receipts.some((receipt) => receipt.id === created.id)) {
      console.log(`Receipt already exists: ${created.id}`);
      return;
    }
    const receipt = appendReceipt(root, created);
    writeReceipts(root, [...receipts, receipt]);
    console.log(`Created receipt ${receipt.id}`);
    console.log(`  commit: ${receipt.commit}`);
    console.log(`  session: ${receipt.agent}:${receipt.sessionId}`);
    console.log(`  hash: ${receipt.hash}`);
    return;
  }

  if (command === "verify") {
    const receipts = readReceipts(root);
    const result = verifyReceipts(receipts);
    console.log(`${result.checked} receipt(s) checked`);
    if (result.valid) {
      console.log("Receipt chain is valid.");
    } else {
      for (const problem of result.problems) console.error(problem);
      process.exitCode = 1;
    }
    return;
  }

  if (command === "dashboard") {
    const instance = await startDashboard({
      root,
      port: numberArg(args, "port", 4173),
      days: numberArg(args, "days", 30),
      pricing: typeof args.pricing === "string" ? loadPricing(resolve(args.pricing)) : undefined,
    });
    console.log(`AgentYield dashboard running at ${instance.url}`);
    console.log("Press Ctrl+C to stop.");
    return;
  }

  printHelp();
  if (command !== "help" && command !== "--help" && command !== "-h") process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`AgentYield: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});


