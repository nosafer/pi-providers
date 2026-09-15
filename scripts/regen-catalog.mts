#!/usr/bin/env node
/**
 * CLI entry for the catalog regen.
 *
 * src/regen-catalog.ts is the single implementation (the plugin runs it
 * automatically inside /providers sync-catalog). This file only adapts it to a
 * shell command, so `npm run regen-catalog` and the in-plugin path can never
 * drift apart and fight over the generated file.
 */
import { regenCatalogFromInstalledPiAi } from "../src/regen-catalog.ts";

const count = regenCatalogFromInstalledPiAi();
if (count === undefined) {
  console.error(
    "pi-ai provider data not found. Set PI_PROVIDERS_PI_AI_DATA to its data dir.",
  );
  process.exit(1);
}
console.log(`wrote src/generated/pi-ai-catalog.json models=${count}`);
