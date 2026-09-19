import { describe, expect, it } from "vitest";
import {
  buildManagedProviderRegistration,
  inferGatewayCompat,
  mergeCompat,
} from "../src/compat.ts";
import type { ModelsProviderConfig } from "../src/types.ts";

const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

function sharellmProvider(
  extra: Partial<ModelsProviderConfig> = {},
): ModelsProviderConfig {
  return {
    baseUrl: "https://sharellm.net/v1",
    api: "openai-completions",
    models: [
      {
        id: "deepseek-v4.1-flash",
        name: "deepseek-v4.1-flash",
        reasoning: true,
        input: ["text"],
        contextWindow: 1024000,
        maxTokens: 16384,
        cost,
      },
    ],
    ...extra,
  };
}

describe("inferGatewayCompat", () => {
  it("disables developer role for sharellm.net", () => {
    expect(inferGatewayCompat("https://sharellm.net/v1")).toEqual({
      supportsDeveloperRole: false,
    });
  });

  it("does not infer for official OpenAI or unrelated hosts", () => {
    expect(inferGatewayCompat("https://api.openai.com/v1")).toBeUndefined();
    expect(inferGatewayCompat("http://47.253.187.66:55651/v1")).toBeUndefined();
  });
});

describe("mergeCompat", () => {
  it("lets model-level compat override provider-level", () => {
    expect(
      mergeCompat(
        { supportsDeveloperRole: false, supportsReasoningEffort: true },
        { supportsDeveloperRole: true },
      ),
    ).toEqual({
      supportsDeveloperRole: true,
      supportsReasoningEffort: true,
    });
  });

  it("returns undefined when both sides are empty", () => {
    expect(mergeCompat(undefined, undefined)).toBeUndefined();
  });
});

describe("buildManagedProviderRegistration", () => {
  it("forwards provider-level compat onto each registered model", () => {
    const payload = buildManagedProviderRegistration(
      sharellmProvider({
        compat: { supportsDeveloperRole: false },
      }),
    );
    expect(payload.models[0]?.compat).toEqual({
      supportsDeveloperRole: false,
    });
  });

  it("infers sharellm compat even when models.json omitted it", () => {
    const payload = buildManagedProviderRegistration(sharellmProvider());
    expect(payload.models[0]?.compat).toEqual({
      supportsDeveloperRole: false,
    });
  });

  it("keeps explicit model compat over inferred provider compat", () => {
    const payload = buildManagedProviderRegistration(
      sharellmProvider({
        models: [
          {
            id: "gpt-5.6-sol",
            name: "gpt-5.6-sol",
            reasoning: true,
            input: ["text", "image"],
            contextWindow: 272000,
            maxTokens: 16384,
            cost,
            compat: { supportsDeveloperRole: true },
          },
        ],
      }),
    );
    expect(payload.models[0]?.compat).toEqual({
      supportsDeveloperRole: true,
    });
  });
});
