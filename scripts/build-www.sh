#!/usr/bin/env bash
# Copy the static GitHub Pages files into www/ for Capacitor.
# Root files stay put so https://tawattthot.github.io/youtube-finder/ keeps working.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/www"
rm -rf "$DEST"
mkdir -p "$DEST"
cp "$ROOT/index.html" "$ROOT/style.css" "$ROOT/mirrors.js" "$ROOT/api.js" "$ROOT/filter.js" "$ROOT/local.js" "$ROOT/app.js" "$DEST/"
echo "Built www/ for Capacitor ($(ls "$DEST" | wc -l) files)."
