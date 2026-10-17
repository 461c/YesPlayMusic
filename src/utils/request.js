import { getCookie } from '@/utils/auth';
import { archiveMode, archiveError } from '@/utils/archiveMode';
import axios from 'axios';
import { isAndroid } from '@/utils/androidAudio';
import androidApiAdapter from '@/utils/androidApi';

let baseURL = '';
// Web 和 Electron 跑在不同端口避免同时启动时冲突
if (process.env.IS_ELECTRON) {
  if (process.env.NODE_ENV === 'production') {
    baseURL = process.env.VUE_APP_ELECTRON_API_URL;
  } else {
    baseURL = process.env.VUE_APP_ELECTRON_API_URL_DEV;
  }
} else {
  baseURL = process.env.VUE_APP_NETEASE_API_URL;
}

const service = axios.create({
  baseURL,
  ...(isAndroid ? { adapter: androidApiAdapter } : {}),
  withCredentials: true,
  timeout: 15000,
});

service.interceptors.request.use(function (config) {
  if (archiveMode()) throw archiveError();
  if (!config.params) config.params = {};
  if (baseURL.length) {
    if (
      (baseURL[0] !== '/' || isAndroid) &&
      !process.env.IS_ELECTRON &&
      getCookie('MUSIC_U') !== null
    ) {
      config.params.cookie = `MUSIC_U=${getCookie('MUSIC_U')};`;
    }
  } else {
    console.error("You must set up the baseURL in the service's config");
  }

  if (isAndroid) {
    const cookie = ['MUSIC_U', '__csrf']
      .map(key => [key, getCookie(key)])
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value};`)
      .join('');
    config.params.cookie = cookie;
    window.YesPlayMusicAndroid.setCookie(cookie);
  }

  if (!process.env.IS_ELECTRON && !config.url.includes('/login')) {
    config.params.realIP = '211.161.244.70';
  }

  // Force real_ip
  const enableRealIP = JSON.parse(
    localStorage.getItem('settings')
  ).enableRealIP;
  const realIP = JSON.parse(localStorage.getItem('settings')).realIP;
  if (process.env.VUE_APP_REAL_IP) {
    config.params.realIP = process.env.VUE_APP_REAL_IP;
  } else if (enableRealIP) {
    config.params.realIP = realIP;
  }

  const proxy = JSON.parse(localStorage.getItem('settings')).proxyConfig;
  if (['HTTP', 'HTTPS'].includes(proxy.protocol)) {
    config.params.proxy = `${proxy.protocol}://${proxy.server}:${proxy.port}`;
  }

  return config;
});

service.interceptors.response.use(
  response => {
    if (archiveMode()) throw archiveError();
    const res = response.data;
    return res;
  },
  async error => {
    /** @type {import('axios').AxiosResponse | null} */
    let response;
    let data;
    if (error === 'TypeError: baseURL is undefined') {
      response = error;
      data = error;
      console.error("You must set up the baseURL in the service's config");
    } else if (error.response) {
      response = error.response;
      data = response.data;
    }

    if (
      !error.config?.skipAuthRedirect &&
      response &&
      typeof data === 'object' &&
      data.code === 301 &&
      data.msg === '需要登录'
    ) {
      // Keep the saved identity and snapshots usable if authentication/API support disappears.
      console.warn('登录状态失效，保留本地音乐库；请手动重新登录。');
    }
    return Promise.reject(error);
  }
);

export default service;
