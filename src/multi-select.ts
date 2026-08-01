export function toggleMultiSelectState(selected: Set<string>, item: string): Set<string> {
  const next = new Set(selected);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

export function formatMultiSelectLabels(ids: string[], selected: Set<string>): string[] {
  return [
    ...ids.map((id) => (selected.has(id) ? `[x] ${id}` : `[ ] ${id}`)),
    "---",
    "Done",
    "Cancel",
  ];
}

export function parseMultiSelectChoice(choice: string): "done" | "cancel" | "sep" | { id: string } {
  if (choice === "Done") return "done";
  if (choice === "Cancel") return "cancel";
  if (choice === "---") return "sep";
  const id = choice.replace(/^\[[ x]\]\s*/, "");
  return { id };
}
