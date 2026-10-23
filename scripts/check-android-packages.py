"""Check the single distributable APK and its stable compatibility identity."""
import os
from pathlib import Path
import re
import subprocess

sdk = Path(os.environ['ANDROID_HOME']) / 'build-tools' / '35.0.0'

def run(tool, *args):
    return subprocess.check_output([str(sdk / tool), *map(str, args)], text=True)

certificates = []
for filename, package, label in [
    ('YesPlayMusic-Android-Tablet.apk', 'com.luna.music', 'YesPlayMusic'),
]:
    badging = run('aapt', 'dump', 'badging', filename)
    assert f"package: name='{package}'" in badging, badging
    assert f"application-label:'{label}'" in badging, badging
    assert "versionCode='41148'" in badging, badging
    assert "sdkVersion:'24'" in badging, badging
    manifest = run('aapt', 'dump', 'xmltree', filename, 'AndroidManifest.xml')
    for entry in [
        'com.yesplaymusic.tablet.MainActivity',
        'com.yesplaymusic.tablet.PlaybackService',
        'com.yesplaymusic.tablet.LocalApiService',
        'android.media.browse.MediaBrowserService',
        'androidx.media3.session.MediaLibraryService',
        'androidx.media3.session.MediaButtonReceiver',
        'android.intent.action.MEDIA_BUTTON',
        'android:foregroundServiceType',
    ]:
        assert entry in manifest, (filename, entry)
    signing = run('apksigner', 'verify', '--print-certs', filename)
    digest = re.search(r'Signer #1 certificate SHA-256 digest: ([0-9a-f]+)', signing)
    assert digest, signing
    certificates.append(digest.group(1))
    print(f'{filename}: {package}; media entries verified; certificate {digest.group(1)}')
assert len(certificates) == 1
