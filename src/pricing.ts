import { existsSync, readFileSync } from "node:fs";
import type { AgentEvent } from "./types.js";
import { isRecord } from "./normalize.js";

export interface ModelPrice {
  inputPerMTokens?: number;
  cachedInputPerMTokens?: number;
  outputPerMTokens?: number;
}

export interface PricingConfig {
  version: 1;
  currency: "USD";
  models: Record<string, ModelPrice>;
}

export function loadPricing(filePath: string): PricingConfig | undefined {
  if (!existsSync(filePath)) return undefined;
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed) || parsed.version !== 1 || parsed.currency !== "USD" || !isRecord(parsed.models)) {
    throw new Error("Invalid pricing file. Expected version 1, currency USD, and a models object.");
  }
  return parsed as unknown as PricingConfig;
}

function priceFor(model: string | undefined, pricing: PricingConfig): ModelPrice | undefined {
  if (!model) return undefined;
  return pricing.models[model] ?? pricing.models["*"];
}

export function estimateEventCost(event: AgentEvent, pricing: PricingConfig): number | undefined {
  if (!event.usage || event.usage.costUsd !== undefined) return undefined;
  const price = priceFor(event.model, pricing);
  if (!price) return undefined;
  const input = event.usage.inputTokens * (price.inputPerMTokens ?? 0) / 1_000_000;
  const cached = event.usage.cachedInputTokens * (price.cachedInputPerMTokens ?? 0) / 1_000_000;
  const output = event.usage.outputTokens * (price.outputPerMTokens ?? 0) / 1_000_000;
  return Math.round((input + cached + output) * 1_000_000) / 1_000_000;
}

