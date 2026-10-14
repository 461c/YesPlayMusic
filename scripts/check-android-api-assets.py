"""Fail before publication if Android asset filtering drops a runtime file."""
import json
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as apk:
    manifest = json.loads(apk.read("assets/api/manifest.json"))
    packaged = set(apk.namelist())
    missing = [name for name in manifest["files"] if "assets/api/" + name not in packaged]
    if missing:
        raise SystemExit("Missing API assets in APK: " + ", ".join(missing[:20]))
    for abi in ("arm64-v8a", "armeabi-v7a", "x86_64"):
        for library in ("libnode.so", "libypm-node.so", "libc++_shared.so"):
            if f"lib/{abi}/{library}" not in packaged:
                raise SystemExit(f"Missing runtime library: {abi}/{library}")
    print(f"APK contains all {len(manifest['files'])} API files and all three native runtimes")
