import Vue from 'vue';
import { archiveMode } from '@/utils/archiveMode';
import Vuex from 'vuex';
import state from './state';
import mutations from './mutations';
import actions from './actions';
import { changeAppearance, changeThemeColor } from '@/utils/common';
import Player from '@/utils/Player';
import {
  updateAndroidCache,
  updateAndroidConcurrentPlayback,
  updateAndroidLyrics,
  updateAndroidQuality,
} from '@/utils/androidEnvironment';
// vuex 自定义插件
import saveToLocalStorage from './plugins/localStorage';
import { getSendSettingsPlugin } from './plugins/sendSettings';

Vue.use(Vuex);

let plugins = [saveToLocalStorage];
if (process.env.IS_ELECTRON === true) {
  let sendSettings = getSendSettingsPlugin();
  plugins.push(sendSettings);
}
const options = {
  state,
  mutations,
  actions,
  plugins,
};

const store = new Vuex.Store(options);
store.watch(
  state => JSON.stringify([state.data.user?.userId, state.liked.songs]),
  () => {
    const native = window.YesPlayMusicAndroid;
    if (process.env.VUE_APP_ANDROID === 'true' && native?.send)
      native.send(
        JSON.stringify({
          action: 'favorites',
          userId: String(store.state.data.user?.userId || ''),
          likedSongIds: store.state.liked.songs,
        })
      );
  }
);

const supportedLanguages = ['en', 'zh-CN', 'zh-TW'];
if (!supportedLanguages.includes(store.state.settings.lang)) {
  const hasSavedLanguage = ![undefined, null].includes(
    store.state.settings.lang
  );
  const languageMap = new Map([
    ['zh', 'zh-CN'],
    ['zh-TW', 'zh-TW'],
    ['en', 'en'],
  ]);
  const browserLanguage = languageMap.get(
    languageMap.has(navigator.language)
      ? navigator.language
      : navigator.language.slice(0, 2)
  );
  store.state.settings.lang = hasSavedLanguage ? 'en' : browserLanguage || 'en';
  localStorage.setItem('settings', JSON.stringify(store.state.settings));
}

changeAppearance(store.state.settings.appearance);
changeThemeColor(store.state.settings.themeColor);

const updateSystemAppearance = () => {
  if ([undefined, 'auto'].includes(store.state.settings.appearance)) {
    changeAppearance(store.state.settings.appearance);
    changeThemeColor(store.state.settings.themeColor);
  }
};
window.addEventListener('pageshow', updateSystemAppearance);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateSystemAppearance();
});
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
if (systemTheme.addEventListener) {
  systemTheme.addEventListener('change', updateSystemAppearance);
} else {
  systemTheme.addListener(updateSystemAppearance);
}
window.addEventListener(
  'yesplaymusic-native-environment',
  updateSystemAppearance
);
store.watch(
  state =>
    state.showLyrics &&
    [true, 'blur', 'dynamic'].includes(state.settings.lyricsBackground),
  updateAndroidLyrics,
  { immediate: true }
);
store.watch(state => state.settings.musicQuality, updateAndroidQuality, {
  immediate: true,
});
store.watch(
  state => state.settings.allowConcurrentPlayback,
  updateAndroidConcurrentPlayback,
  { immediate: true }
);
store.watch(
  state =>
    JSON.stringify([
      state.settings.automaticallyCacheSongs,
      state.settings.cacheLimit,
    ]),
  updateAndroidCache,
  { immediate: true }
);

store.watch(
  state => state.settings.archiveMode,
  () => window.YesPlayMusicAndroid?.setArchiveMode?.(archiveMode()),
  { immediate: true }
);

store.watch(
  state => state.settings.showSystemStatusBar,
  value => window.YesPlayMusicAndroid?.setStatusBarVisible?.(value !== false),
  { immediate: true }
);

let player = new Player();
player = new Proxy(player, {
  set(target, prop, val) {
    // console.log({ prop, val });
    target[prop] = val;
    if (prop === '_howler') return true;
    target.saveSelfToLocalStorage();
    target.sendSelfToIpcMain();
    return true;
  },
});
store.state.player = player;

export default store;
