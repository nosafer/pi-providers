import { describe, expect, it } from "vitest";
import {
  extractContextFromRow,
  inferContextFromModelId,
  resolveContextWindow,
} from "../src/context-infer.ts";

describe("inferContextFromModelId", () => {
  it("knows gpt-5.5 / gpt-5.6 from OpenAI-class heuristics", () => {
    expect(inferContextFromModelId("gpt-5.5")).toBe(1_000_000);
    expect(inferContextFromModelId("gpt-5.6-luna")).toBe(1_050_000);
  });

  it("uses official xAI windows for grok-4.x", () => {
    expect(inferContextFromModelId("grok-4.5")).toBe(500_000);
    expect(inferContextFromModelId("grok-4.3")).toBe(1_000_000);
  });

  it("uses 智谱 overview for glm-5.x", () => {
    expect(inferContextFromModelId("glm-5.2")).toBe(1_000_000);
    expect(inferContextFromModelId("glm-5.1")).toBe(200_000);
    expect(inferContextFromModelId("glm-5")).toBe(200_000);
  });

  it("knows gemini-3 as 1M", () => {
    expect(inferContextFromModelId("gemini-3.6-flash-high")).toBe(1_000_000);
  });
});

describe("extractContextFromRow", () => {
  it("reads context_window", () => {
    expect(extractContextFromRow({ id: "x", context_window: 200000 })).toBe(200000);
  });

  it("reads max_model_len", () => {
    expect(extractContextFromRow({ max_model_len: 131072 })).toBe(131072);
  });
});

describe("resolveContextWindow", () => {
  it("prefers API over heuristics", () => {
    expect(
      resolveContextWindow({ id: "gpt-5.5", fromApi: 500000, fallback: 128000 }),
    ).toBe(500000);
  });

  it("uses pi-ai catalog for gpt-5.5 (openai short-context default 272k)", () => {
    // Official openai.json uses 272000; long 1.05M is via modelOverrides
    expect(resolveContextWindow({ id: "gpt-5.5", fallback: 128000 })).toBe(272_000);
  });

  it("prefers grok-4.5 = 500k not 1M", () => {
    expect(resolveContextWindow({ id: "grok-4.5" })).toBe(500_000);
  });
});
