import { musicQualityLevel } from './musicQuality';

const native =
  process.env.VUE_APP_ANDROID === 'true' && window.YesPlayMusicAndroid;

export function systemAppearance() {
  if (native && native.isSystemDark) {
    return native.isSystemDark() ? 'dark' : 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function initializeAndroidEnvironment() {
  if (!native) return;
  const apply = environment => {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      document.documentElement.style.setProperty(
        `--android-inset-${side}`,
        `${Number(environment[side]) || 0}px`
      );
    }
  };
  if (native.getEnvironment) apply(JSON.parse(native.getEnvironment()));
  window.addEventListener('yesplaymusic-native-environment', event => {
    apply(event.detail);
  });
}

export function updateAndroidAppearance(appearance) {
  if (native && native.setAppearance) {
    native.setAppearance(appearance === 'dark');
  }
}

export function updateAndroidLyrics(open) {
  if (native && native.setLyricsOpen) native.setLyricsOpen(open);
}

export function updateAndroidQuality(quality) {
  if (native && native.setMusicQuality) {
    native.setMusicQuality(musicQualityLevel(quality));
  }
}

export function updateAndroidConcurrentPlayback(enabled) {
  if (native && native.setConcurrentPlayback) {
    native.setConcurrentPlayback(Boolean(enabled));
  }
}

export function updateAndroidCache(config) {
  if (native && native.configureAudioCache) {
    const [enabled, limit] = JSON.parse(config);
    native.configureAudioCache(
      Boolean(enabled),
      limit === false ? 0 : limit ?? 8192
    );
  }
}
