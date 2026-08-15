import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publishManagedProvider } from "../src/runtime-publish.ts";
import { switchModel } from "../src/switch-model.ts";
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

describe("publishManagedProvider", () => {
  let prevAgentDir: string | undefined;

  beforeEach(() => {
    prevAgentDir = process.env.PI_AGENT_DIR;
    const agentDir = mkdtempSync(join(tmpdir(), "pi-providers-pub-"));
    process.env.PI_AGENT_DIR = agentDir;
    writeFileSync(
      join(agentDir, "models.json"),
      JSON.stringify({
        providers: {
          mkopen: {
            baseUrl: "http://example/v1",
            api: "openai-completions",
            models: [sampleModel("gpt-4o")],
          },
        },
      }),
    );
  });

  afterEach(() => {
    if (prevAgentDir === undefined) delete process.env.PI_AGENT_DIR;
    else process.env.PI_AGENT_DIR = prevAgentDir;
  });

  it("registers provider without awaiting refresh", async () => {
    const registerProvider = vi.fn();

    const result = await publishManagedProvider(
      { registerProvider } as never,
      "mkopen",
    );

    expect(result.ok).toBe(true);
    expect(registerProvider).toHaveBeenCalledOnce();
  });
});

describe("switchModel", () => {
  it("finds the model without a blocking refresh", async () => {
    const result = await switchModel({
      providerId: "mkopen",
      modelId: "gpt-4o",
      setAsDefault: false,
      pi: { setModel: async () => true },
      modelRegistry: {
        find: () => ({ id: "gpt-4o" } as never),
      },
      setDefault: () => {},
    });
    expect(result.ok).toBe(true);
  });
});
