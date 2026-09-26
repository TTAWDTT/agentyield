import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultLogDirectory, discoverLocalFiles, formatBytes } from "../src/discover.js";

test("discovers recent JSONL files under a fake Claude home", () => {
  const home = mkdtempSync(join(tmpdir(), "agentyield-discover-"));
  try {
    const dir = join(home, ".claude", "projects", "project");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "session.jsonl"), "{}\n");
    const files = discoverLocalFiles("claude", { home, days: 7 });
    assert.equal(files.length, 1);
    assert.equal(files[0].sizeBytes > 0, true);
    assert.equal(defaultLogDirectory("codex", home), join(home, ".codex", "sessions"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("formats human readable sizes", () => {
  assert.equal(formatBytes(10), "10 B");
  assert.equal(formatBytes(2048), "2.0 KB");
  assert.equal(formatBytes(3 * 1024 * 1024), "3.0 MB");
});
