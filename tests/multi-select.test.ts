import { describe, expect, it } from "vitest";
import {
  formatMultiSelectLabels,
  parseMultiSelectChoice,
  toggleMultiSelectState,
} from "../src/multi-select.ts";
import { switchModel } from "../src/switch-model.ts";

describe("multi-select", () => {
  it("toggles selection", () => {
    let s = new Set<string>();
    s = toggleMultiSelectState(s, "a");
    expect([...s]).toEqual(["a"]);
    s = toggleMultiSelectState(s, "a");
    expect([...s]).toEqual([]);
  });

  it("formats labels", () => {
    const labels = formatMultiSelectLabels(["a", "b"], new Set(["a"]));
    expect(labels[0]).toBe("[x] a");
    expect(labels[1]).toBe("[ ] b");
    expect(labels.at(-2)).toBe("Done");
  });

  it("parses choice", () => {
    expect(parseMultiSelectChoice("Done")).toBe("done");
    expect(parseMultiSelectChoice("[x] foo")).toEqual({ id: "foo" });
  });
});

describe("switchModel", () => {
  it("sets model and optional default", async () => {
    const defaults: string[] = [];
    const result = await switchModel({
      providerId: "mkopen",
      modelId: "gpt-4o",
      setAsDefault: true,
      pi: { setModel: async () => true },
      modelRegistry: {
        refresh: async () => {},
        find: () => ({ id: "gpt-4o" }),
      },
      setDefault: (p, m) => defaults.push(`${p}/${m}`),
    });
    expect(result.ok).toBe(true);
    expect(defaults).toEqual(["mkopen/gpt-4o"]);
  });

  it("fails when model missing", async () => {
    const result = await switchModel({
      providerId: "mkopen",
      modelId: "nope",
      setAsDefault: false,
      pi: { setModel: async () => true },
      modelRegistry: {
        refresh: async () => {},
        find: () => undefined,
      },
      setDefault: () => {},
    });
    expect(result.ok).toBe(false);
  });
});
