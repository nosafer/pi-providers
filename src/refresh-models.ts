import type { ModelEntry } from "./types.ts";
import { toModelEntry } from "./discover.ts";

export function planRefresh(
  selectedIds: string[],
  remoteIds: string[],
): { keep: string[]; newCandidates: string[]; stale: string[] } {
  const remote = new Set(remoteIds);
  const selected = new Set(selectedIds);
  const keep = selectedIds.filter((id) => remote.has(id));
  const stale = selectedIds.filter((id) => !remote.has(id));
  const newCandidates = remoteIds.filter((id) => !selected.has(id));
  return { keep, newCandidates, stale };
}

export function applyRefreshSelection(opts: {
  keep: string[];
  added: string[];
  remoteModels: ModelEntry[];
  localModels: ModelEntry[];
}): ModelEntry[] {
  const remoteMap = new Map(opts.remoteModels.map((m) => [m.id, m]));
  const localMap = new Map(opts.localModels.map((m) => [m.id, m]));
  const result: ModelEntry[] = [];
  const seen = new Set<string>();

  // Selected ids that the remote no longer serves are intentionally absent:
  // a refresh mirrors the remote, so stale entries are dropped (not kept).
  for (const id of [...opts.keep, ...opts.added]) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(remoteMap.get(id) ?? localMap.get(id) ?? toModelEntry(id));
  }
  return result;
}
