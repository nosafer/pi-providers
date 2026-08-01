import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteManagedProvider,
  isManaged,
  loadModels,
  loadSidecar,
  upsertManagedProvider,
} from "../src/store.ts";
import type { ModelEntry } from "../src/types.ts";

function sampleModel(id: string): ModelEntry {
  return {
    id,
    name: id,
    reasoning: false,
    input: ["text"],
    contextWindow: 128000,
    maxTokens: 16384,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

describe("store", () => {
  let agentDir: string;

  beforeEach(() => {
    agentDir = mkdtempSync(join(tmpdir(), "pi-providers-"));
  });

  it("upserts managed provider without clobbering foreign providers", () => {
    writeFileSync(
      join(agentDir, "models.json"),
      JSON.stringify({
        providers: {
          hand: {
            baseUrl: "http://hand",
            api: "openai-completions",
            models: [sampleModel("keep-me")],
          },
        },
      }),
    );

    upsertManagedProvider(
      {
        id: "mkopen",
        displayName: "mkopen",
        baseUrl: "https://mk.example/v1",
        api: "openai-completions",
        keyMode: "literal",
        apiKey: "sk-test",
        models: [sampleModel("gpt-4o")],
      },
      agentDir,
    );

    const models = loadModels(agentDir);
    expect(models.providers?.hand?.models?.[0]?.id).toBe("keep-me");
    expect(models.providers?.mkopen?.baseUrl).toBe("https://mk.example/v1");
    expect(models.providers?.mkopen?.models?.[0]?.id).toBe("gpt-4o");
    expect(models.providers?.mkopen?.apiKey).toBeUndefined();

    const auth = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf8"));
    expect(auth.mkopen).toEqual({ type: "api_key", key: "sk-test" });

    const side = loadSidecar(agentDir);
    expect(side.managedProviders).toContain("mkopen");
    expect(side.providers.mkopen.selectedModelIds).toEqual(["gpt-4o"]);
    expect(isManaged("mkopen", agentDir)).toBe(true);
    expect(isManaged("hand", agentDir)).toBe(false);
  });

  it("stores env key reference in models.json only", () => {
    upsertManagedProvider(
      {
        id: "freeopen",
        displayName: "freeopen",
        baseUrl: "https://free.example/v1",
        api: "anthropic-messages",
        keyMode: "env",
        envVar: "FREEOPEN_KEY",
        models: [sampleModel("claude")],
      },
      agentDir,
    );
    const models = loadModels(agentDir);
    expect(models.providers?.freeopen?.apiKey).toBe("$FREEOPEN_KEY");
    expect(existsSync(join(agentDir, "auth.json"))).toBe(false);
  });

  it("refuses to delete non-managed provider", () => {
    writeFileSync(
      join(agentDir, "models.json"),
      JSON.stringify({
        providers: { hand: { baseUrl: "x", api: "openai-completions", models: [] } },
      }),
    );
    expect(() => deleteManagedProvider("hand", agentDir)).toThrow(/not managed/i);
  });

  it("deletes managed provider from models, auth, sidecar", () => {
    upsertManagedProvider(
      {
        id: "mkopen",
        displayName: "mkopen",
        baseUrl: "https://mk.example/v1",
        api: "openai-completions",
        keyMode: "literal",
        apiKey: "sk-x",
        models: [sampleModel("a")],
      },
      agentDir,
    );
    deleteManagedProvider("mkopen", agentDir);
    expect(loadModels(agentDir).providers?.mkopen).toBeUndefined();
    const auth = JSON.parse(readFileSync(join(agentDir, "auth.json"), "utf8"));
    expect(auth.mkopen).toBeUndefined();
    expect(loadSidecar(agentDir).managedProviders).not.toContain("mkopen");
  });
});
