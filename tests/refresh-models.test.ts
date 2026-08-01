import { describe, expect, it } from "vitest";
import { applyRefreshSelection, planRefresh } from "../src/refresh-models.ts";
import { toModelEntry } from "../src/discover.ts";

describe("planRefresh", () => {
  it("keeps selected, lists new, marks missing remote as stale", () => {
    const plan = planRefresh(["a", "b", "gone"], ["a", "b", "c", "d"]);
    expect(plan.keep).toEqual(["a", "b"]);
    expect(plan.newCandidates).toEqual(["c", "d"]);
    expect(plan.stale).toEqual(["gone"]);
  });

  it("does not auto-restore deleted ids", () => {
    const plan = planRefresh(["a"], ["a", "b"]);
    expect(plan.keep).toEqual(["a"]);
    expect(plan.newCandidates).toEqual(["b"]);
  });
});

describe("applyRefreshSelection", () => {
  it("merges keep, added, and stale locals", () => {
    const remote = [toModelEntry("a"), toModelEntry("b"), toModelEntry("c")];
    const local = [toModelEntry("a"), toModelEntry("gone")];
    const models = applyRefreshSelection({
      keep: ["a"],
      added: ["c"],
      stale: ["gone"],
      remoteModels: remote,
      localModels: local,
    });
    expect(models.map((m) => m.id)).toEqual(["a", "c", "gone"]);
  });
});
