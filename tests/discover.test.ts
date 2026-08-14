import { afterEach, describe, expect, it, vi } from "vitest";
import { discoverModels, normalizeModelsUrl, toModelEntry } from "../src/discover.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeModelsUrl", () => {
  it("appends /models correctly", () => {
    expect(normalizeModelsUrl("https://x.com/v1")).toBe("https://x.com/v1/models");
    expect(normalizeModelsUrl("https://x.com/v1/")).toBe("https://x.com/v1/models");
    expect(normalizeModelsUrl("https://x.com")).toBe("https://x.com/v1/models");
  });
});

describe("discoverModels", () => {
  it("parses openai data list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ data: [{ id: "a" }, { id: "b", name: "Bee" }] }), {
            status: 200,
          }),
      ),
    );
    const res = await discoverModels({
      baseUrl: "https://x.com/v1",
      api: "openai-completions",
      apiKey: "k",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.models.map((m) => m.id)).toEqual(["a", "b"]);
      expect(res.models[1].name).toBe("Bee");
    }
  });

  it("returns error on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    const res = await discoverModels({
      baseUrl: "https://x.com/v1",
      api: "openai-completions",
      apiKey: "bad",
    });
    expect(res.ok).toBe(false);
  });
});

describe("toModelEntry", () => {
  it("fills defaults for unknown models", () => {
    const m = toModelEntry("x-unknown-model");
    expect(m.contextWindow).toBe(128000);
    expect(m.name).toBe("x-unknown-model");
  });

  it("uses pi-ai catalog for gpt-5.5 context", () => {
    expect(toModelEntry("gpt-5.5").contextWindow).toBe(272_000);
    expect(toModelEntry("gpt-5.5").reasoning).toBe(true);
  });

  it("uses official catalog input: vision models get image, text-only do not", () => {
    expect(toModelEntry("gpt-5.5").input).toEqual(["text", "image"]);
    expect(toModelEntry("grok-4.5").input).toEqual(["text", "image"]);
    expect(toModelEntry("gemini-3.6-flash-high").input).toEqual(["text", "image"]);
    expect(toModelEntry("deepseek-v4-flash").input).toEqual(["text"]);
    expect(toModelEntry("x-unknown-model").input).toEqual(["text"]);
  });
});
