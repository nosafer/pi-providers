import { describe, expect, it } from "vitest";
import {
  extractContextFromRow,
  inferContextFromModelId,
  resolveContextWindow,
} from "../src/context-infer.ts";

describe("inferContextFromModelId", () => {
  it("knows gpt-5.5 as 1M", () => {
    expect(inferContextFromModelId("gpt-5.5")).toBe(1_000_000);
  });

  it("knows glm-5.1 as 256k", () => {
    expect(inferContextFromModelId("glm-5.1")).toBe(256_000);
    expect(inferContextFromModelId("glm-5")).toBe(256_000);
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

  it("falls back to heuristics", () => {
    expect(resolveContextWindow({ id: "gpt-5.5", fallback: 128000 })).toBe(1_000_000);
  });
});
