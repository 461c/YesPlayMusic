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

if ([undefined, null].includes(store.state.settings.lang)) {
  const defaultLang = 'en';
  const langMapper = new Map()
    .set('zh', 'zh-CN')
    .set('zh-TW', 'zh-TW')
    .set('en', 'en')
    .set('tr', 'tr');
  store.state.settings.lang =
    langMapper.get(
      langMapper.has(navigator.language)
        ? navigator.language
        : navigator.language.slice(0, 2)
    ) || defaultLang;
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
