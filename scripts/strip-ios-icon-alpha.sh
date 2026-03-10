#!/usr/bin/env sh
set -eu

if command -v magick >/dev/null 2>&1; then
  MAGICK_CMD="magick"
elif command -v convert >/dev/null 2>&1; then
  MAGICK_CMD="convert"
else
  echo "ImageMagick is required to strip alpha channels from iOS app icons." >&2
  exit 1
fi

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

strip_dir() {
  dir="$1"

  if [ ! -d "$dir" ]; then
    return
  fi

  find "$dir" -type f -name '*.png' -print0 | while IFS= read -r -d '' file; do
    tmp_file=$(mktemp "${TMPDIR:-/tmp}/desqta-icon.XXXXXX.png")

    if [ "$MAGICK_CMD" = "magick" ]; then
      magick "$file" -background "#151415" -alpha remove -alpha off PNG24:"$tmp_file"
    else
      convert "$file" -background "#151415" -alpha remove -alpha off PNG24:"$tmp_file"
    fi

    mv "$tmp_file" "$file"
  done
}

strip_dir "$ROOT_DIR/src-tauri/icons/ios"
strip_dir "$ROOT_DIR/src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
