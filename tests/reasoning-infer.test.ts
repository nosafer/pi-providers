import { describe, expect, it } from "vitest";
import {
  formatThinkingSummary,
  inferReasoningProfile,
  listSupportedThinkingLevels,
} from "../src/reasoning-infer.ts";

describe("inferReasoningProfile", () => {
  it("marks gpt-5.5 as reasoning with effort map", () => {
    const p = inferReasoningProfile("gpt-5.5");
    expect(p.reasoning).toBe(true);
    expect(listSupportedThinkingLevels(p)).toContain("high");
    expect(listSupportedThinkingLevels(p)).toContain("max");
  });

  it("marks grok-4.5 as reasoning", () => {
    const p = inferReasoningProfile("grok-4.5");
    expect(p.reasoning).toBe(true);
    const levels = listSupportedThinkingLevels(p);
    expect(levels).toContain("high");
    expect(levels).not.toContain("xhigh");
  });

  it("marks kimi/k3-class as reasoning with limited levels", () => {
    const p = inferReasoningProfile("kimi-k3");
    expect(p.reasoning).toBe(true);
    const levels = listSupportedThinkingLevels(p);
    expect(levels).toEqual(["off", "low", "medium", "high"]);
  });

  it("unknown model is non-reasoning", () => {
    const p = inferReasoningProfile("some-chat-7b");
    expect(p.reasoning).toBe(false);
    expect(listSupportedThinkingLevels(p)).toEqual(["off"]);
  });
});

describe("formatThinkingSummary", () => {
  it("shows available levels", () => {
    const p = inferReasoningProfile("gpt-5.5");
    const s = formatThinkingSummary({
      modelId: "gpt-5.5",
      ...p,
      current: "medium",
    });
    expect(s).toContain("gpt-5.5");
    expect(s).toContain("medium");
  });
});
