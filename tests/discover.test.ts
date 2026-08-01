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

  it("infers gpt-5.5 as 1M", () => {
    expect(toModelEntry("gpt-5.5").contextWindow).toBe(1_000_000);
  });
});
