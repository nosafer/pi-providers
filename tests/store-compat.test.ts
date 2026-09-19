import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { upsertManagedProvider } from "../src/store.ts";

const dirs: string[] = [];

function tempAgentDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "pi-providers-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

const model = {
  id: "deepseek-v4.1-flash",
  name: "deepseek-v4.1-flash",
  reasoning: true,
  input: ["text" as const],
  contextWindow: 1024000,
  maxTokens: 16384,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

describe("upsertManagedProvider compat", () => {
  it("writes inferred sharellm compat on first add", () => {
    const agentDir = tempAgentDir();
    upsertManagedProvider(
      {
        id: "mkdeep",
        displayName: "mkdeep",
        baseUrl: "https://sharellm.net/v1",
        api: "openai-completions",
        keyMode: "literal",
        apiKey: "sk-test",
        models: [model],
      },
      agentDir,
    );
    const saved = JSON.parse(
      readFileSync(join(agentDir, "models.json"), "utf8"),
    ) as {
      providers: { mkdeep: { compat?: { supportsDeveloperRole?: boolean } } };
    };
    expect(saved.providers.mkdeep.compat).toEqual({
      supportsDeveloperRole: false,
    });
  });

  it("keeps existing compat across later edits", () => {
    const agentDir = tempAgentDir();
    upsertManagedProvider(
      {
        id: "mkdeep",
        displayName: "mkdeep",
        baseUrl: "https://sharellm.net/v1",
        api: "openai-completions",
        keyMode: "literal",
        apiKey: "sk-test",
        models: [model],
        compat: { supportsDeveloperRole: false, supportsReasoningEffort: false },
      },
      agentDir,
    );
    upsertManagedProvider(
      {
        id: "mkdeep",
        displayName: "mkdeep",
        baseUrl: "https://sharellm.net/v1",
        api: "openai-completions",
        keyMode: "literal",
        apiKey: "sk-test",
        models: [{ ...model, contextWindow: 200000 }],
      },
      agentDir,
    );
    const saved = JSON.parse(
      readFileSync(join(agentDir, "models.json"), "utf8"),
    ) as {
      providers: { mkdeep: { compat?: Record<string, unknown> } };
    };
    expect(saved.providers.mkdeep.compat).toEqual({
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
    });
  });
});
