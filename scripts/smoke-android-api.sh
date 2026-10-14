#!/usr/bin/env bash
set -euo pipefail
adb install -g --no-incremental android/app/build/outputs/apk/release/app-release.apk
adb logcat -c
adb shell am start -W -n com.yesplaymusic.tablet/.MainActivity
api_port=''
for attempt in $(seq 1 90); do
  api_port=$(adb logcat -d -s YesPlayMusicAPI:I | sed -n 's/.*Local API ready at http:\/\/127\.0\.0\.1:\([0-9]*\).*/\1/p' | head -1)
  if [ -n "$api_port" ]; then break; fi
  if adb logcat -d -b crash | grep -q 'FORTIFY:'; then
    sleep 3
    adb logcat -d -b crash
    exit 1
  fi
  if ! adb shell pidof com.yesplaymusic.tablet >/dev/null; then
    sleep 3
    adb logcat -d -b crash
    exit 1
  fi
  sleep 1
done
if [ -z "$api_port" ]; then
  adb shell uiautomator dump /sdcard/yesplaymusic-ui.xml || true
  adb shell cat /sdcard/yesplaymusic-ui.xml || true
  adb logcat -d -b crash
  adb logcat -d -s YesPlayMusicAPI AndroidRuntime System.err libc chromium
  echo 'Embedded API did not become ready on Android'
  exit 1
fi
adb forward tcp:13000 "tcp:$api_port"
trap 'adb forward --remove tcp:13000' EXIT
curl --fail --silent http://127.0.0.1:13000/ypm/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["service"] == "yesplaymusic-local-api"'
# The local API must survive the Activity moving into the background.
adb shell input keyevent KEYCODE_HOME
curl --fail --silent http://127.0.0.1:13000/ypm/health | python3 -c 'import json,sys; assert json.load(sys.stdin)["service"] == "yesplaymusic-local-api"'
adb shell am force-stop com.yesplaymusic.tablet
adb logcat -c
adb shell am start -W -n com.yesplaymusic.tablet/.MainActivity
for attempt in $(seq 1 45); do
  if adb logcat -d -s YesPlayMusicAPI:I | grep -q 'Local API ready at'; then
    echo 'Android cold start, background API and process restart passed'
    exit 0
  fi
  sleep 1
done
adb logcat -d -s YesPlayMusicAPI AndroidRuntime chromium
exit 1
