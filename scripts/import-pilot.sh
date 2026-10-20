#!/usr/bin/env bash
# Run inside the existing checkout. No environment settings, secrets or provider limits are changed.
set -euo pipefail
cd "$(dirname "$0")/.."

node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<24||(major===24&&minor<5))throw new Error("WebHunt kræver Node 24.5+")'
# Existing Codespaces may predate the Dockerfile's Python setup. Install only
# the missing standard Debian packages, using existing root/noninteractive sudo.
if ! command -v python3 >/dev/null 2>&1 || ! python3 -c 'import venv, ensurepip' >/dev/null 2>&1; then
  echo 'Klargør Python og venv til importen (Debians officielle pakker).'
  if [ "$(id -u)" = 0 ] && command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y --no-install-recommends python3 python3-venv ca-certificates
  elif command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
    sudo -n apt-get update
    sudo -n apt-get install -y --no-install-recommends python3 python3-venv ca-certificates
  else
    echo 'Python/venv mangler, og denne terminal kan ikke installere dem. Ingen virksomhedsdata er ændret.'
    exit 1
  fi
fi
# Fail before installation if this machine's proxy still blocks the source.
python3 scripts/check-overture-network.py --required
if ! node -e 'require.resolve("tsx")' >/dev/null 2>&1; then
  npm ci --cache /tmp/webhunt-npm-cache
fi
export PIP_CACHE_DIR="${TMPDIR:-/tmp}/webhunt-pip-cache"
npm run data:setup
npm run data:refresh -- --publish-seed
node --use-env-proxy --import tsx scripts/verify-pilot.ts
