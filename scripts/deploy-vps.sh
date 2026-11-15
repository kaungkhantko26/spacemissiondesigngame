#!/usr/bin/env bash
# Build the static site for a server root (no GitHub Pages sub-path) and copy it to a VPS over SSH.
#   ./scripts/deploy-vps.sh                      # uses the ssh alias "new-vps" and /var/www/spacemission
#   VPS_HOST=my-alias REMOTE_DIR=/srv/site ./scripts/deploy-vps.sh
#   SITE_PATH=/game ./scripts/deploy-vps.sh      # if the site is served under a sub-path such as https://example.com/game/
# Run it on the machine that has the SSH alias (your Mac). It only writes inside REMOTE_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."
HOST="${VPS_HOST:-new-vps}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/spacemission}"
SITE_PATH="${SITE_PATH:-}"                 # empty = served at the root of the domain

case "$REMOTE_DIR" in ""|"/"|"/var"|"/var/www"|"/home"|"/root"|"/etc"|"/usr") echo "Refusing to deploy into '$REMOTE_DIR'. Use a dedicated folder."; exit 1;; esac

echo "== building (base path: '${SITE_PATH:-/}')"
rm -rf out
GITHUB_PAGES=1 NEXT_PUBLIC_BASE_PATH="$SITE_PATH" npm run build
touch out/.nojekyll
find out -name '._*' -delete

echo "== checking the connection to $HOST"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" "mkdir -p '$REMOTE_DIR' && echo connected as \$(whoami) on \$(hostname)"

echo "== uploading to $HOST:$REMOTE_DIR"
# Old hashed assets are kept for one deploy (no --delete on _next/static) so open tabs do not hit 404s; everything else is mirrored.
rsync -az --delete --exclude '_next/static' out/ "$HOST:$REMOTE_DIR/"
rsync -az out/_next/static/ "$HOST:$REMOTE_DIR/_next/static/"

echo "== done. Files are in $REMOTE_DIR on $HOST."
echo "   Point your web server at that folder (see docs/vps.md for an nginx example)."
