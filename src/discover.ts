import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentName } from "./types.js";

export interface DiscoveredFile {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface DiscoverOptions {
  home?: string;
  sourceDir?: string;
  days?: number;
  limit?: number;
}

export function defaultLogDirectory(agent: AgentName, home: string = homedir()): string | undefined {
  if (agent === "claude") return join(home, ".claude", "projects");
  if (agent === "codex") return join(home, ".codex", "sessions");
  return undefined;
}

function walkJsonl(directory: string, result: DiscoveredFile[] = []): DiscoveredFile[] {
  if (!existsSync(directory)) return result;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = join(directory, entry.name);
    if (entry.isDirectory()) walkJsonl(child, result);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      const stats = statSync(child);
      result.push({
        path: child,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
      });
    }
  }
  return result;
}

export function discoverLocalFiles(agent: AgentName, options: DiscoverOptions = {}): DiscoveredFile[] {
  const directory = options.sourceDir ?? defaultLogDirectory(agent, options.home);
  if (!directory || !existsSync(directory)) return [];
  const cutoff = Date.now() - Math.max(1, options.days ?? 7) * 24 * 60 * 60 * 1000;
  return walkJsonl(directory)
    .filter((file) => new Date(file.modifiedAt).getTime() >= cutoff)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
    .slice(0, options.limit ?? 100);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
