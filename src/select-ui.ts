import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

const DEFAULT_VISIBLE = 12;

/**
 * Scrollable select. Unlike ctx.ui.select (renders all rows, no viewport scroll),
 * SelectList keeps maxVisible rows and scrolls so the highlight stays in view.
 */
export async function selectScrollable(
  ctx: ExtensionCommandContext,
  title: string,
  options: string[],
  maxVisible = DEFAULT_VISIBLE,
): Promise<string | null> {
  if (options.length === 0) return null;
  // Short lists: still use SelectList for consistent UX
  const items: SelectItem[] = options.map((value) => ({
    value,
    label: value,
  }));

  return ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
    const container = new Container();
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
    container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));

    const selectList = new SelectList(items, Math.min(items.length, maxVisible), {
      selectedPrefix: (t) => theme.fg("accent", t),
      selectedText: (t) => theme.fg("accent", t),
      description: (t) => theme.fg("muted", t),
      scrollInfo: (t) => theme.fg("dim", t),
      noMatch: (t) => theme.fg("warning", t),
    });
    selectList.onSelect = (item) => done(item.value);
    selectList.onCancel = () => done(null);
    container.addChild(selectList);
    container.addChild(
      new Text(theme.fg("dim", "↑↓ 滚动选择  •  enter 确认  •  esc 取消"), 1, 0),
    );
    container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

    return {
      render: (w: number) => container.render(w),
      invalidate: () => container.invalidate(),
      handleInput: (data: string) => {
        selectList.handleInput(data);
        tui.requestRender();
      },
    };
  });
}
