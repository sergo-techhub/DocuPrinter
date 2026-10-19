#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:2305}"
OUT_DIR="${OUT_DIR:-.}"
HTML='<b>hello world äöü € <img src="data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs="/></b>'
HTML_BASE64=$(printf '%s' "$HTML" | base64 | tr -d '\n')

post() {
  curl -sS --fail-with-body --retry 10 --retry-connrefused --retry-delay 1 \
    -X POST -H "Accept: application/json" -H "Content-type: application/json" \
    -d "$2" "$BASE_URL$1" --output "$3"
}

expect_magic() {
  if ! head -c 8 "$1" | LC_ALL=C grep -aq "$2"; then
    echo "$1 is not a valid $3" >&2
    exit 1
  fi
  echo "$1 ok"
}

curl -sS --fail --retry 30 --retry-all-errors --retry-delay 1 "$BASE_URL/" >/dev/null

post /1/pdf "{\"html\": $(jq -Rn --arg h "$HTML" '$h')}" "$OUT_DIR/test.pdf"
expect_magic "$OUT_DIR/test.pdf" "%PDF" "PDF"

post /1/pdf "{\"html\": \"$HTML_BASE64\", \"base64\": true, \"export\": {\"format\": \"A4\"}}" "$OUT_DIR/test_base64.pdf"
expect_magic "$OUT_DIR/test_base64.pdf" "%PDF" "PDF"

post /1/screenshot "{\"html\": $(jq -Rn --arg h "$HTML" '$h'), \"export\": {\"type\": \"png\"}}" "$OUT_DIR/test.png"
expect_magic "$OUT_DIR/test.png" "PNG" "PNG"

post /1/screenshot "{\"html\": \"$HTML_BASE64\", \"base64\": true}" "$OUT_DIR/test_base64.png"
expect_magic "$OUT_DIR/test_base64.png" "PNG" "PNG"
