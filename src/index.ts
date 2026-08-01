import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerProvidersCommand } from "./commands.ts";
import { listManaged } from "./store.ts";
import { publishManagedProvider } from "./runtime-publish.ts";

export default function (pi: ExtensionAPI) {
  registerProvidersCommand(pi);

  // On each session start, re-publish managed providers into the live registry
  // so models are usable without relying solely on models.json load timing.
  pi.on("session_start", async (_event, ctx) => {
    for (const id of listManaged()) {
      try {
        await publishManagedProvider(pi, ctx.modelRegistry, id);
      } catch {
        // non-fatal
      }
    }
  });
}
