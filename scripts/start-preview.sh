#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .data/logs
preview_log="$PWD/.data/logs/preview.log"
ready() {
  curl --fail --silent --max-time 2 http://127.0.0.1:3000/api/ready 2>/dev/null |
    node -e 'let text="";process.stdin.on("data",c=>text+=c);process.stdin.on("end",()=>{try{const x=JSON.parse(text);process.exit(x.name==="WebHunt"&&x.ready===true?0:1)}catch{process.exit(1)}})' 2>/dev/null
}
if ready; then
  echo 'WebHunt responds on port 3000. Reusing the running server.'
  exit 0
fi
# An atomic local lock prevents duplicate launches from repeated postStart calls.
preview_lock=.data/preview-start.lock
owns_lock=false
if mkdir "$preview_lock" 2>/dev/null; then
  owns_lock=true
  trap 'rmdir "$preview_lock" 2>/dev/null || true' EXIT
  # Do not start on another port or kill an unknown process occupying port 3000.
  if node -e 'const s=require("net").connect(3000,"127.0.0.1");s.on("connect",()=>{s.destroy();process.exit(0)});s.on("error",()=>process.exit(1));s.setTimeout(1500,()=>{s.destroy();process.exit(1)})'; then
    echo 'Port 3000 is already occupied. Waiting for WebHunt readiness; no process is stopped.'
  else
    nohup npm run dev -- --port 3000 > "$preview_log" 2>&1 < /dev/null &
    preview_pid=$!
    echo "$preview_pid" > .data/preview.pid
  fi
fi
for attempt in $(seq 1 60); do
  if ready; then
    echo 'WebHunt is ready on port 3000. Open Ports → 3000 → Open in Browser.'
    exit 0
  fi
  if [ -n "${preview_pid:-}" ] && ! kill -0 "$preview_pid" 2>/dev/null; then
    tail -n 50 "$preview_log"
    exit 1
  fi
  sleep 1
done
echo 'WebHunt did not become ready on port 3000. Inspect .data/logs/preview.log and the Codespace terminal.'
if [ -f "$preview_log" ]; then tail -n 30 "$preview_log"; fi
if [ "$owns_lock" = false ]; then echo 'Another start attempt or stale lock exists. No existing data or process was changed.'; fi
exit 1
