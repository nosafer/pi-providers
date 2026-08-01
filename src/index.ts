import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerProvidersCommand } from "./commands.ts";

export default function (pi: ExtensionAPI) {
  registerProvidersCommand(pi);
}
