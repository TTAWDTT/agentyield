import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCommits, readEvents } from "./ledger.js";
import { buildReport } from "./report.js";
import type { PricingConfig } from "./pricing.js";

const currentDir = dirname(fileURLToPath(import.meta.url));

export interface DashboardOptions {
  root?: string;
  port?: number;
  days?: number;
  host?: string;
  pricing?: PricingConfig;
}

export function startDashboard(options: DashboardOptions = {}): Promise<{ url: string; close: () => Promise<void> }> {
  const root = resolve(options.root ?? process.cwd());
  const port = options.port ?? 4173;
  const host = options.host ?? "127.0.0.1";
  const days = options.days ?? 30;
  const dashboardFile = join(currentDir, "..", "..", "public", "dashboard.html");
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (url.pathname === "/api/report") {
        const report = buildReport(readEvents(root), readCommits(root), { days, pricing: options.pricing });
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.end(JSON.stringify(report));
        return;
      }
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const html = await readFile(dashboardFile, "utf8");
        response.setHeader("Content-Type", "text/html; charset=utf-8");
        response.end(html);
        return;
      }
      response.statusCode = 404;
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.end("Not found");
    } catch (error) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });

  return new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      resolvePromise({
        url: `http://${host}:${port}`,
        close: () => new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose())),
      });
    });
  });
}
