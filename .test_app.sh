#!/bin/bash
set -e

ORIG_WS=$(hyprctl activeworkspace -j | jq -r '.id')
echo "Original workspace: $ORIG_WS"

hyprctl dispatch 'hl.dsp.focus({ workspace = "9" })'
sleep 0.5

./src-tauri/target/release/kareader &
APP_PID=$!
echo "Launched kareader with PID: $APP_PID"

sleep 3.5

WIN=$(hyprctl clients -j | jq '[.[] | select(.class == "kareader" or .initialClass == "kareader")] | .[0]')
echo "Window found: $WIN"

if [ -n "$WIN" ] && [ "$WIN" != "null" ]; then
  AT_X=$(echo "$WIN" | jq -r '.at[0]')
  AT_Y=$(echo "$WIN" | jq -r '.at[1]')
  W=$(echo "$WIN" | jq -r '.size[0]')
  H=$(echo "$WIN" | jq -r '.size[1]')
  echo "Geometry: $AT_X,$AT_Y ${W}x${H}"

  # Capture initial view
  grim -g "$AT_X,$AT_Y ${W}x${H}" kareader_editor_initial.png
  echo "Captured kareader_editor_initial.png"

  # Focus window and add test markdown lines
  hyprctl dispatch 'hl.dsp.focus({ window = "class:kareader" })'
  sleep 0.5
  
  wtype -k Return
  wtype "### Thu nghiem Live Markdown"
  wtype -k Return
  wtype "**Chu in dam**, *in nghieng*, va `ma inline code`."
  wtype -k Return
  wtype "> Day la trich dan Blockquote trong bai viet."
  wtype -k Return
  wtype "---"
  wtype -k Return
  sleep 1.2

  # Capture live typing view
  grim -g "$AT_X,$AT_Y ${W}x${H}" kareader_editor_live_markdown.png
  echo "Captured kareader_editor_live_markdown.png"
fi

kill -9 $APP_PID 2>/dev/null || true
killall kareader 2>/dev/null || true
hyprctl dispatch "hl.dsp.focus({ workspace = \"$ORIG_WS\" })"
echo "Done and returned to workspace $ORIG_WS"
