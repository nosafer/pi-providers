import { describe, expect, it } from "vitest";
import {
  formatThinkingSummary,
  inferReasoningProfile,
  listSupportedThinkingLevels,
} from "../src/reasoning-infer.ts";

describe("inferReasoningProfile — official alignment", () => {
  it("kimi-k3: low / high / max only (Moonshot + pi-ai)", () => {
    const p = inferReasoningProfile("kimi-k3");
    expect(p.reasoning).toBe(true);
    expect(listSupportedThinkingLevels(p).sort()).toEqual(
      ["high", "low", "max"].sort(),
    );
    expect(p.thinkingLevelMap?.max).toBe("max");
    expect(p.thinkingLevelMap?.medium).toBeNull();
  });

  it("grok-4.5: low/medium/high, no max", () => {
    const p = inferReasoningProfile("grok-4.5");
    expect(p.reasoning).toBe(true);
    const levels = listSupportedThinkingLevels(p);
    expect(levels).toContain("high");
    expect(levels).not.toContain("max");
    expect(levels).not.toContain("xhigh");
  });

  it("gpt-5.5: low..xhigh, no max", () => {
    const p = inferReasoningProfile("gpt-5.5");
    const levels = listSupportedThinkingLevels(p);
    expect(levels).toContain("xhigh");
    expect(levels).not.toContain("max");
  });

  it("gpt-5.6-luna: includes max", () => {
    const p = inferReasoningProfile("gpt-5.6-luna");
    expect(listSupportedThinkingLevels(p)).toContain("max");
  });

  it("glm-5.2: high + max", () => {
    const p = inferReasoningProfile("glm-5.2");
    expect(listSupportedThinkingLevels(p).sort()).toEqual(
      ["high", "max"].sort(),
    );
  });

  it("gemini-3.1-pro: LOW/HIGH only", () => {
    const p = inferReasoningProfile("gemini-3.1-pro-preview");
    expect(listSupportedThinkingLevels(p).sort()).toEqual(
      ["high", "low"].sort(),
    );
  });

  it("gemini-3.6-flash: no off (always-on)", () => {
    const p = inferReasoningProfile("gemini-3.6-flash-high");
    expect(p.reasoning).toBe(true);
    expect(listSupportedThinkingLevels(p)).not.toContain("off");
  });

  it("claude-opus-4-7: includes xhigh and max", () => {
    const p = inferReasoningProfile("claude-opus-4-7");
    const levels = listSupportedThinkingLevels(p);
    expect(levels).toContain("max");
    expect(levels).toContain("xhigh");
    expect(levels).toContain("high");
  });

  it("unknown model is non-reasoning", () => {
    const p = inferReasoningProfile("some-chat-7b");
    expect(p.reasoning).toBe(false);
    expect(listSupportedThinkingLevels(p)).toEqual(["off"]);
  });
});

describe("formatThinkingSummary", () => {
  it("shows max for kimi-k3", () => {
    const p = inferReasoningProfile("kimi-k3");
    const s = formatThinkingSummary({
      modelId: "kimi-k3",
      ...p,
      current: "max",
    });
    expect(s).toContain("max");
    expect(s).toContain("kimi-k3");
  });
});
