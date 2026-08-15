import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerProvidersCommand } from "./commands.ts";
import { listManaged, loadSidecar } from "./store.ts";
import { publishManagedProvider } from "./runtime-publish.ts";
import { maybeAutoRegenCatalog } from "./regen-catalog.ts";

export default function (pi: ExtensionAPI) {
  registerProvidersCommand(pi);

  // On each session start: optionally check whether installed pi-ai data is
  // newer than the bundled catalog (pi upgrade) and regenerate. Off by
  // default — enable via /providers settings (autoRegenOnStart). Then
  // re-publish managed providers so models are usable without relying on
  // models.json load timing.
  pi.on("session_start", async (_event, ctx) => {
    if (loadSidecar().autoRegenOnStart) {
      try {
        const note = maybeAutoRegenCatalog();
        if (note) ctx.ui.notify(note, "info");
      } catch {
        // non-fatal — catalog check must never block session start
      }
    }
    // registerProvider is sync + snapshot-safe. Do not await a network
    // refresh here — that is what left the TUI on an empty input box.
    for (const id of listManaged()) {
      try {
        await publishManagedProvider(pi, id);
      } catch {
        // non-fatal
      }
    }
  });
}
