import { describe, expect, it } from "vitest";
import { getCatalogMeta, lookupPiAiCatalog } from "../src/catalog-lookup.ts";
import { inferReasoningProfile, listSupportedThinkingLevels } from "../src/reasoning-infer.ts";
import { resolveContextWindow } from "../src/context-infer.ts";

describe("pi-ai catalog lookup", () => {
  it("has a large official model index", () => {
    const meta = getCatalogMeta();
    expect(meta.modelCount).toBeGreaterThan(500);
  });

  it("kimi-k3 from moonshot catalog: 1M + low/high/max", () => {
    const hit = lookupPiAiCatalog("kimi-k3");
    expect(hit?.contextWindow).toBe(1048576);
    expect(hit?.reasoning).toBe(true);
    expect(hit?.thinkingLevelMap?.max).toBe("max");
    expect(hit?.thinkingLevelMap?.low).toBe("low");
    const levels = listSupportedThinkingLevels(inferReasoningProfile("kimi-k3"));
    expect(levels.sort()).toEqual(["high", "low", "max"].sort());
  });

  it("grok-4.5: 500k + low/medium/high", () => {
    expect(resolveContextWindow({ id: "grok-4.5" })).toBe(500000);
    const levels = listSupportedThinkingLevels(inferReasoningProfile("grok-4.5"));
    expect(levels).toContain("high");
    expect(levels).not.toContain("max");
  });

  it("claude-opus-4-7: 1M + xhigh/max", () => {
    expect(resolveContextWindow({ id: "claude-opus-4-7" })).toBe(1000000);
    const levels = listSupportedThinkingLevels(inferReasoningProfile("claude-opus-4-7"));
    expect(levels).toContain("max");
    expect(levels).toContain("xhigh");
  });

  it("gemini-3.1-pro-preview: LOW/HIGH", () => {
    const p = inferReasoningProfile("gemini-3.1-pro-preview");
    expect(listSupportedThinkingLevels(p).sort()).toEqual(["high", "low"].sort());
  });

  it("fuzzy matches gateway alias gemini-3.6-flash-high", () => {
    const hit = lookupPiAiCatalog("gemini-3.6-flash-high");
    expect(hit?.canonicalId).toMatch(/gemini-3\.6-flash/);
    expect(hit?.contextWindow).toBeGreaterThan(500000);
  });

  it("exposes official input modalities", () => {
    expect(lookupPiAiCatalog("gpt-5.5")?.input).toEqual(["text", "image"]);
    expect(lookupPiAiCatalog("deepseek-v4-flash")?.input).toEqual(["text"]);
  });
});
