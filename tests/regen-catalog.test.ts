import { describe, expect, it } from "vitest";
import { buildCatalogIndex } from "../src/regen-catalog.ts";
import { lookupPiAiCatalog } from "../src/catalog-lookup.ts";
import { resolveContextWindow } from "../src/context-infer.ts";
import { inferReasoningProfile } from "../src/reasoning-infer.ts";

describe("regen-catalog (single implementation)", () => {
  it("builds a large index with expected count", () => {
    const out = buildCatalogIndex();
    expect(out.modelCount).toBeGreaterThan(1000);
    expect(out.generatedFrom).toContain("pi-ai");
  });

  it("keys are normalized lower-case ids", () => {
    const out = buildCatalogIndex();
    const keys = Object.keys(out.models);
    expect(keys.every((k) => k === k.toLowerCase())).toBe(true);
    expect(keys.some((k) => k.includes("/"))).toBe(true); // prefixed keys exist
  });

  it("kimi-k3 resolves to 1M + low/high/max after regen", () => {
    expect(resolveContextWindow({ id: "kimi-k3" })).toBe(1048576);
    const p = inferReasoningProfile("kimi-k3");
    expect(p.reasoning).toBe(true);
    expect(p.thinkingLevelMap?.max).toBe("max");
    expect(p.thinkingLevelMap?.low).toBe("low");
  });

  it("grok-4.5 resolves to 500k + low/medium/high after regen", () => {
    expect(resolveContextWindow({ id: "grok-4.5" })).toBe(500000);
    const p = inferReasoningProfile("grok-4.5");
    expect(p.reasoning).toBe(true);
    expect(p.thinkingLevelMap?.medium).toBe("medium");
    expect(p.thinkingLevelMap?.max).toBeNull();
  });

  it("canonicalId is present on hits", () => {
    const hit = lookupPiAiCatalog("grok-4.5");
    expect(hit?.canonicalId).toBe("grok-4.5");
  });
});
