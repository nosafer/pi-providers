#!/bin/bash
# Deploy the plugin source tree to the pi extensions dir as a standalone copy.
# The extensions dir is a *clean artifact* (no .git, node_modules, tests, scripts).
#
# Usage: ./scripts/deploy-plugin.sh
# Run after committing changes to make the installed plugin match the repo.

set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${PI_EXTENSIONS_DIR:-$HOME/.pi/agent/extensions}/pi-providers"

echo "src : $SRC"
echo "dest: $DEST"

# If the installed plugin's catalog is newer than the repo's (auto-regen
# wrote it during sync-catalog), sync it back into the repo first so the
# repo stays the source of truth.
REPO_CAT="$SRC/src/generated/pi-ai-catalog.json"
DEST_CAT="$DEST/src/generated/pi-ai-catalog.json"
if [ -f "$DEST_CAT" ] && [ "$DEST_CAT" -nt "$REPO_CAT" ]; then
  echo "plugin catalog is newer than repo — copying back to repo"
  cp "$DEST_CAT" "$REPO_CAT"
fi

# Recreate the dest dir (fresh copy, no stale files).
rm -rf "$DEST"
mkdir -p "$DEST"

# Copy runtime files only.
cp "$SRC/package.json" "$DEST/"
cp "$SRC/tsconfig.json" "$DEST/"
cp "$SRC/index.ts" "$DEST/"
cp -R "$SRC/src" "$DEST/src"

# Keep only the generated catalog (drop editor temp files if any).
find "$DEST/src" -name '*.tmp*' -o -name '*.bak' | xargs -r rm -f

echo "deployed: $(du -sh "$DEST" | cut -f1) at $DEST"
echo "catalog: $(python3 -c "import json;print(json.load(open('$DEST/src/generated/pi-ai-catalog.json'))['modelCount'])") models"
