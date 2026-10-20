#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if curl --fail --silent --max-time 2 http://127.0.0.1:3000/ >/dev/null; then
  echo 'WebHunt already responds on port 3000.'
  exit 0
fi

nohup npm run dev > /tmp/webhunt-preview.log 2>&1 < /dev/null &
preview_pid=$!
for attempt in $(seq 1 60); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:3000/ >/dev/null; then
    echo 'WebHunt is ready. Open Ports → 3000 → Open in Browser.'
    exit 0
  fi
  if ! kill -0 "$preview_pid" 2>/dev/null; then
    tail -n 50 /tmp/webhunt-preview.log
    exit 1
  fi
  sleep 1
done

echo 'WebHunt did not become ready. Last startup messages:'
tail -n 50 /tmp/webhunt-preview.log
exit 1
