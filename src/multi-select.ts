export function toggleMultiSelectState(selected: Set<string>, item: string): Set<string> {
  const next = new Set(selected);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

/** Done/Cancel 置顶，避免长列表时光标落在底部导致顶部模型不可见。 */
export function formatMultiSelectLabels(ids: string[], selected: Set<string>): string[] {
  const selectedIds = ids.filter((id) => selected.has(id));
  const unselectedIds = ids.filter((id) => !selected.has(id));
  // 已选项靠前，方便回看；未选项在后
  const ordered = [...selectedIds, ...unselectedIds];
  return [
    "Done",
    "Cancel",
    "---",
    ...ordered.map((id) => (selected.has(id) ? `[x] ${id}` : `[ ] ${id}`)),
  ];
}

export function parseMultiSelectChoice(
  choice: string,
): "done" | "cancel" | "sep" | { id: string } {
  if (choice === "Done") return "done";
  if (choice === "Cancel") return "cancel";
  if (choice === "---") return "sep";
  const id = choice.replace(/^\[[ x]\]\s*/, "");
  return { id };
}
