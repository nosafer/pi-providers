/**
 * Locate the installed pi-ai official provider data directory.
 *
 * pi ships model catalogs at:
 *   <pi install>/node_modules/@earendil-works/pi-ai/dist/providers/data
 *
 * The plugin cannot resolve pi-ai via import.meta.resolve (jiti virtual
 * modules), so we probe well-known install locations. Supports an explicit
 * override via env PI_PROVIDERS_PI_AI_DATA.
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DATA_SUBDIR = "dist/providers/data";

function candidates(): string[] {
  const env = process.env.PI_PROVIDERS_PI_AI_DATA;
  const list = env ? [env] : [];

  // npm global install (macOS/Homebrew: /usr/local/lib/node_modules, nvm/other: ~/.nvm/.../lib/node_modules)
  list.push(
    "/usr/local/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai",
    join(homedir(), ".nvm/versions/node"),
  );

  // Node global root via `npm root -g` is the most robust on any platform.
  try {
    const root = execSync("npm root -g", { encoding: "utf8" }).trim();
    list.push(
      join(root, "@earendil-works/pi-coding-agent", "node_modules", "@earendil-works", "pi-ai"),
    );
  } catch {
    // ignore — fall back to the fixed candidates above
  }

  // Bun-based installs / local dev clones
  list.push(join(homedir(), ".bun/install/global/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-ai"));

  return list;
}

let cachedDir: string | undefined;

/**
 * First directory (in priority order) that contains the providers data files.
 * Returns undefined when pi-ai data cannot be found. Safe for concurrent calls.
 */
export function findPiAiDataDir(): string | undefined {
  if (cachedDir) return cachedDir;
  for (const dir of candidates()) {
    const dataDir = join(dir, DATA_SUBDIR);
    if (existsSync(dataDir)) {
      const files = readdirSync(dataDir).filter((f) => f.endsWith(".json"));
      if (files.length > 0) {
        cachedDir = dataDir;
        return dataDir;
      }
    }
  }
  return undefined;
}

/** All provider JSON file paths inside the pi-ai data dir, sorted. */
export function findPiAiDataFiles(): string[] {
  const dir = findPiAiDataDir();
  if (!dir) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => join(dir, f));
}
