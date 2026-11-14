#!/usr/bin/env bash
# Build the static site and publish ./out to the gh-pages branch of origin.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO_URL="$(git remote get-url origin)"
BASE="/$(basename "${REPO_URL%.git}")"
rm -rf out
GITHUB_PAGES=1 NEXT_PUBLIC_BASE_PATH="$BASE" npm run build
touch out/.nojekyll
find out -name '._*' -delete
TMP="$(mktemp -d)"
cp -R out/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -q -m "Deploy static site"
git push -f "$REPO_URL" gh-pages
echo "Published. Site: https://$(echo "$REPO_URL" | sed -E 's#.*github.com/([^/]+)/.*#\1#').github.io$BASE/"
