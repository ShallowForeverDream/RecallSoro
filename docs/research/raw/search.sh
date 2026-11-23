#!/bin/bash
# usage: search.sh <targetId> <query...>
TID="$1"; shift
Q=$(printf '%s ' "$@" | sed 's/ *$//')
ENC=$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$Q")
curl -s -X POST --data-raw "https://www.baidu.com/s?wd=$ENC" "http://localhost:3456/navigate?target=$TID" >/dev/null 2>&1
sleep 2.5
echo "### QUERY: $Q"
curl -s -X POST "http://localhost:3456/eval?target=$TID" -d 'Array.from(document.querySelectorAll("div.result, div.c-container")).slice(0,8).map(function(r){var h=r.querySelector("h3 a");var a=r.querySelector(".c-abstract");return {t:h?h.innerText:"",u:h?h.href:"",d:a?a.innerText.slice(0,220):""}}).filter(function(x){return x.t}).map(function(x){return x.t+"\n  URL: "+x.u+"\n  "+x.d})'
echo
