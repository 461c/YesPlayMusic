import Vue from 'vue';
import Dexie from 'dexie';
import request from '@/utils/request';
import {
  libraryScope,
  getCachedPlaylist,
  savePlaylistSnapshot,
} from './offlineLibrary';
import {
  getAlbumFromCache,
  cacheAlbum,
  getSavedTrackDetails,
  cacheTrackDetail,
  getTrackSource,
  cacheTrackSource,
} from './db';
import { retainTracks } from './retainedTracks';
import { mapTrackPlayableStatus } from './common';
import { artworkBridge } from './desktopArtwork';
import { musicQualityLevel } from './musicQuality';
import { archiveMode } from './archiveMode';

const db = new Dexie('yesplaymusic-library-cache-checks');
db.version(1).stores({ checks: '&key,scope' });
const managers = new WeakMap();
export const cacheGroups = [
  { key: 'likes', title: '我喜欢' },
  { key: 'created', title: '创建' },
  { key: 'saved', title: '收藏' },
  { key: 'albums', title: '专辑' },
];
export function cacheTargets(state) {
  const uid = String(state.data.user?.userId || '');
  const likedId = String(state.data.likedSongPlaylistID || '');
  const playlists = (state.liked.playlists || []).map(item => ({
    key: 'playlist:' + item.id,
    id: item.id,
    type: 'playlist',
    group:
      String(item.id) === likedId ||
      (String(item.creator?.userId) === uid && item.specialType === 5)
        ? 'likes'
        : String(item.creator?.userId) === uid
        ? 'created'
        : 'saved',
    name: item.name,
    cover: item.coverImgUrl,
    archiveStatus: item.archiveStatus,
  }));
  return [
    ...playlists,
    ...(state.liked.albums || []).map(item => ({
      key: 'album:' + item.id,
      id: item.id,
      type: 'album',
      group: 'albums',
      name: item.name,
      cover: item.picUrl,
      archiveStatus: item.archiveStatus,
    })),
  ];
}
export function manifest(target, data) {
  if (target.type === 'album') {
    if (!data?.album || !Array.isArray(data.songs))
      throw new Error('专辑内容不完整，保留旧缓存');
    const songs = data.songs.filter(song => !song.archiveStatus);
    return {
      ids: songs.map(song => String(song.id)),
      songs,
      cover: data.album.picUrl,
      version: JSON.stringify([
        data.album.name,
        data.album.picUrl,
        songs.map(song => [String(song.id), song.name]),
      ]),
    };
  }
  const p = data?.playlist;
  if (!p || !Array.isArray(p.trackIds))
    throw new Error('歌单内容不完整，保留旧缓存');
  return {
    ids: p.trackIds.map(song => String(song.id)),
    songs: p.tracks || [],
    cover: p.coverImgUrl,
    version: JSON.stringify([
      p.name,
      p.coverImgUrl,
      p.updateTime,
      p.trackUpdateTime,
      p.trackIds.map(song => String(song.id)),
    ]),
  };
}
export function riskResponse(error) {
  const code = Number(error?.response?.status || error?.code);
  const http = (error?.message || '').match(
    /(?:HTTP|API|Response code[: ]+)\s*(-?[0-9]{3})/i
  );
  return (
    (http &&
      [301, 401, 403, 405, 429, 460, 461, 462, 512, -460, -462].includes(
        Number(http[1])
      )) ||
    [301, 401, 403, 405, 429, 460, 461, 462, 512, -460, -462].includes(code) ||
    /验证码|风控|访问频繁|操作频繁|安全验证|限流|captcha/i.test(
      error?.message || error?.msg || ''
    )
  );
}
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const API_INTERVAL_MS = 500;
const BUDGET_WINDOW_MS = 60000;
const REQUESTS_PER_WINDOW = 100;

export function needsCacheUpdate(mark) {
  return Boolean(mark && mark.status !== 'cached');
}

export class CacheGovernor {
  constructor(scope, storage = localStorage, wait = sleep) {
    this.key = 'library-cache-cooldown:' + scope;
    this.storage = storage;
    this.wait = wait;
    let budget = {};
    try {
      budget = JSON.parse(storage.getItem(this.key + ':budget') || '{}');
    } catch (_) {
      /* Optional storage. */
    }
    this.since = Number(budget.since) || Date.now();
    this.requests = Number(budget.requests) || 0;
    this.last = Number(storage.getItem(this.key + ':last')) || 0;
  }
  trip(message) {
    this.storage.setItem(this.key, String(Date.now() + 20 * 60000));
    throw new Error(message);
  }
  async before(current, accountRequest = true) {
    for (;;) {
      if (!current()) throw new Error('任务已停止');
      const now = Date.now();
      if (Number(this.storage.getItem(this.key)) > now)
        throw new Error('更新已冷却暂停，请稍后再手动继续');
      // Artwork comes from the CDN and does not consume an account API slot.
      if (!accountRequest) return;
      if (now - this.since >= BUDGET_WINDOW_MS) {
        this.since = now;
        this.requests = 0;
      }
      const next = Math.max(
        this.last + API_INTERVAL_MS,
        this.requests >= REQUESTS_PER_WINDOW ? this.since + BUDGET_WINDOW_MS : 0
      );
      if (now >= next) break;
      this.onWait?.();
      await this.wait(Math.min(200, next - now));
    }
    this.requests++;
    this.last = Date.now();
    this.storage.setItem(
      this.key + ':budget',
      JSON.stringify({ since: this.since, requests: this.requests })
    );
    this.storage.setItem(this.key + ':last', String(this.last));
  }
}
class LibraryCacheManager {
  constructor(store) {
    Object.defineProperty(this, 'store', { value: store });
    this.starting = false;
    this.running = false;
    this.stopped = false;
    this.message = '';
    this.progress = 0;
    this.total = 0;
    this.songDone = 0;
    this.songTotal = 0;
    this.songChecked = 0;
    this.songIndex = 0;
    this.currentTargetFraction = 0;
    this.phaseLabel = '';
    this.phaseProgress = 0;
    this.phaseTotal = 0;
    this.networkPending = false;
    this.detailsLoaded = 0;
    this.detailsTotal = 0;
    this.imagesDone = 0;
    this.imagesTotal = 0;
    this.imagesCached = 0;
    this.currentTargetImagesDone = 0;
    this.currentTargetImagesTotal = 0;
    this.currentTargetSongsDone = 0;
    this.currentTargetMediaTotal = 0;
    this.currentSong = '';
    this.currentTargetKey = '';
    this.stage = '';
    this.paused = false;
    this.downloadedBytes = 0;
    this.downloadTotalBytes = 0;
    this.downloadSpeed = 0;
    this.speedSample = null;
    this.activeDownloadKind = '';
    this.speedTimer = null;
    this.mode = '';
    this.failedItems = 0;
    this.unavailableItems = 0;
    this.partialItems = 0;
    this.marks = {};
    this.taskId = '';
    this.controller = null;
    this.quality = store.state.settings.musicQuality;
    this.snapshots = new Map();
    this.scope = '';
    this.errors = 0;
  }
  targets() {
    return cacheTargets(this.store.state);
  }
  async restore() {
    await this.store.dispatch('restoreLibrary');
    const scope = libraryScope(this.store.state.data);
    if (this.running || scope === this.scope) return;
    this.scope = scope;
    this.marks = {};
    this.snapshots.clear();
    const records = await db.checks
      .where('scope')
      .equals(scope || '')
      .toArray()
      .catch(() => []);
    if (scope !== libraryScope(this.store.state.data) || scope !== this.scope)
      return;
    records.forEach(record => Vue.set(this.marks, record.target, record));
  }
  current() {
    return (
      !this.stopped &&
      this.scope === libraryScope(this.store.state.data) &&
      this.quality === this.store.state.settings.musicQuality &&
      !archiveMode()
    );
  }
  guard() {
    if (!this.current())
      throw new Error('任务已停止、账号或音质已切换，或已进入纪念模式');
  }
  stop() {
    this.stopped = true;
    this.paused = false;
    this.stage = '正在取消';
    this.controller?.abort();
    if (this.taskId)
      window.YesPlayMusicAndroid?.stopLibraryCacheTask?.(this.taskId);
    this.message = '正在取消，保留已完成的缓存';
  }
  pause() {
    this.paused = true;
    if (this.taskId)
      window.YesPlayMusicAndroid?.pauseLibraryCacheTask?.(this.taskId);
    this.stage =
      this.taskId || !['下载音乐', '缓存封面', '下载封面'].includes(this.stage)
        ? '正在暂停'
        : '当前文件完成后暂停';
  }
  resume() {
    this.paused = false;
    if (this.taskId)
      window.YesPlayMusicAndroid?.resumeLibraryCacheTask?.(this.taskId);
    this.stage = '继续处理';
  }
  async waitIfPaused() {
    while (this.paused && this.current()) {
      this.stage = '已暂停';
      await sleep(200);
    }
    this.guard();
  }
  async waitForRequestSlot(ms) {
    let remaining = ms;
    while (remaining > 0 && this.current()) {
      await this.waitIfPaused();
      const slice = Math.min(200, remaining);
      await sleep(slice);
      remaining -= slice;
    }
    this.guard();
  }
  updateDownload(loaded, total = 0, kind = this.activeDownloadKind) {
    const now = Date.now();
    const previous = this.speedSample;
    this.downloadedBytes = Math.max(0, Number(loaded) || 0);
    this.downloadTotalBytes = Math.max(0, Number(total) || 0);
    this.activeDownloadKind = kind;
    if (
      previous &&
      now > previous.at &&
      this.downloadedBytes >= previous.bytes
    ) {
      const instantaneous =
        ((this.downloadedBytes - previous.bytes) * 1000) / (now - previous.at);
      this.downloadSpeed = Math.round(
        this.downloadSpeed * 0.35 + instantaneous * 0.65
      );
    }
    this.speedSample = { at: now, bytes: this.downloadedBytes };
    this.updateMediaProgress(
      this.downloadTotalBytes
        ? this.downloadedBytes / this.downloadTotalBytes
        : 0
    );
  }
  updateMediaProgress(activeFraction = 0) {
    if (!this.currentTargetMediaTotal) return;
    const done = this.currentTargetImagesDone + this.currentTargetSongsDone;
    this.updateTargetProgress(
      0.45 +
        0.55 *
          ((done + Math.min(0.99, Math.max(0, activeFraction))) /
            this.currentTargetMediaTotal)
    );
  }
  startSpeedMonitor() {
    clearTimeout(this.speedTimer);
    const refresh = () => {
      if (this.speedSample && Date.now() - this.speedSample.at > 1200)
        this.downloadSpeed = 0;
      if (this.running) this.speedTimer = setTimeout(refresh, 500);
    };
    this.speedTimer = setTimeout(refresh, 500);
  }
  setPhase(label, total = 0, progress = 0) {
    this.phaseLabel = label;
    this.phaseTotal = Math.max(0, Number(total) || 0);
    this.phaseProgress = Math.max(0, Number(progress) || 0);
  }
  updateTargetProgress(fraction) {
    this.currentTargetFraction = Math.max(
      this.currentTargetFraction,
      Math.min(1, Number(fraction) || 0)
    );
  }
  async mark(target, status, extra = {}) {
    this.guard();
    const record = {
      ...(this.marks[target.key] || {}),
      ...extra,
      status,
      scope: this.scope,
      target: target.key,
      key: this.scope + ':' + target.key,
      checkedAt: Date.now(),
    };
    Vue.set(this.marks, target.key, record);
    await db.checks.put(JSON.parse(JSON.stringify(record)));
  }
  async api(url, params) {
    await this.waitIfPaused();
    await this.governor.before(
      () => this.current(),
      true,
      () => {
        this.stage = '等待接口请求间隔';
      }
    );
    await this.waitIfPaused();
    const endpointLabels = {
      '/playlist/detail': '读取歌单歌曲清单',
      '/album': '读取专辑歌曲清单',
      '/song/detail': '补齐歌曲信息',
    };
    this.stage = endpointLabels[url] || '请求音乐服务';
    this.networkPending = true;
    let data;
    try {
      data = await request({
        url,
        params: { ...params, timestamp: Date.now() },
        signal: this.controller.signal,
        skipAuthRedirect: true,
      });
    } finally {
      this.networkPending = false;
    }
    await this.waitIfPaused();
    this.guard();
    if (data?.code !== 200) {
      if (riskResponse(data))
        this.governor.trip('接口要求验证、登录或限制请求，已停止并进入冷却');
      const error = new Error(
        data?.message || data?.msg || '内容不可见，保留缓存'
      );
      error.unavailable = [404, -1, 20001].includes(Number(data?.code));
      throw error;
    }
    return data;
  }
  async snapshot(target) {
    const previous = this.snapshots.get(target.key);
    if (previous && Date.now() - previous.at < 5 * 60000) return previous.data;
    const data = await this.api(
      target.type === 'album' ? '/album' : '/playlist/detail',
      { id: target.id, n: 50, s: 0 }
    );
    manifest(target, data);
    this.snapshots.set(target.key, { at: Date.now(), data });
    return data;
  }
  async audioStates(ids, onProgress = () => {}) {
    const native = window.YesPlayMusicAndroid;
    const states = {};
    if (native?.getLibraryAudioStates) {
      for (let start = 0; start < ids.length; start += 200) {
        Object.assign(
          states,
          JSON.parse(
            native.getLibraryAudioStates(
              JSON.stringify(ids.slice(start, start + 200))
            )
          )
        );
        onProgress(Math.min(start + 200, ids.length));
      }
    } else {
      let checked = 0;
      for (const id of ids) {
        const cached = await getTrackSource(id);
        states[id] =
          cached?.source?.byteLength &&
          (!cached.requestedLevel ||
            cached.requestedLevel ===
              musicQualityLevel(this.store.state.settings.musicQuality))
            ? 2
            : 0;
        onProgress(++checked);
      }
    }
    return states;
  }
  async preserve(target) {
    const previous =
      target.type === 'album'
        ? await getAlbumFromCache(target.id)
        : await getCachedPlaylist(target.id, this.scope);
    const ids =
      target.type === 'album'
        ? (previous?.songs || []).map(song => String(song.id))
        : [
            ...(previous?.playlist?.trackIds || []),
            ...(previous?.playlist?.archivedTracks || []),
          ].map(song => String(song.id));
    this.guard();
    if (window.YesPlayMusicAndroid)
      ids.forEach(id => window.YesPlayMusicAndroid.preserveCachedTrack(id));
    else {
      const pinned = JSON.parse(
        localStorage.getItem('preserved-audio') || '[]'
      );
      localStorage.setItem(
        'preserved-audio',
        JSON.stringify([...new Set([...pinned, ...ids])])
      );
    }
  }
  async check(target) {
    this.stage = '读取收藏内容';
    this.setPhase('读取收藏歌曲清单');
    this.snapshots.delete(target.key);
    const data = await this.snapshot(target),
      fresh = manifest(target, data);
    this.updateTargetProgress(0.1);
    const old =
      target.type === 'album'
        ? await getAlbumFromCache(target.id)
        : await getCachedPlaylist(target.id, this.scope);
    let same = false;
    try {
      same = manifest(target, old).version === fresh.version;
    } catch (_) {
      /* First explicit cache request. */
    }
    this.songTotal += fresh.ids.length;
    this.setPhase('检查音乐缓存', fresh.ids.length, 0);
    this.stage = '检查音乐缓存';
    const checkedBefore = this.songChecked;
    const states = await this.audioStates(fresh.ids, checked => {
      this.songChecked = checkedBefore + checked;
      this.phaseProgress = checked;
      this.updateTargetProgress(
        0.1 + (fresh.ids.length ? (0.65 * checked) / fresh.ids.length : 0.65)
      );
    });
    this.songChecked = checkedBefore + fresh.ids.length;
    this.songDone += fresh.ids.length;
    const cached = fresh.ids.filter(id => states[id] === 2).length;
    const last = this.marks[target.key];
    this.stage = '读取本地歌曲信息';
    this.setPhase('核对歌曲信息');
    const details = new Map(
      (await getSavedTrackDetails(fresh.ids)).map(song => [
        String(song.id),
        song,
      ])
    );
    mapTrackPlayableStatus(fresh.songs, data.privileges || []).forEach(song =>
      details.set(String(song.id), song)
    );
    const imageUrls = new Set(
      [
        fresh.cover || target.cover,
        ...[...details.values()].map(
          song => song.al?.picUrl || song.album?.picUrl
        ),
      ].filter(Boolean)
    );
    this.imagesTotal += imageUrls.size;
    this.setPhase('检查封面缓存', imageUrls.size, 0);
    this.stage = '检查封面缓存';
    let imageIndex = 0;
    let allImages = true;
    for (const url of imageUrls) {
      const cached = this.hasPicture(url);
      if (!cached) allImages = false;
      imageIndex++;
      this.imagesDone++;
      if (cached) this.imagesCached++;
      this.phaseProgress = imageIndex;
      this.updateTargetProgress(
        0.75 + (imageUrls.size ? (0.25 * imageIndex) / imageUrls.size : 0.25)
      );
    }
    if (details.size < fresh.ids.length) allImages = false;
    this.updateTargetProgress(1);
    const complete =
      same &&
      cached === fresh.ids.length &&
      allImages &&
      last?.status === 'cached' &&
      last.version === fresh.version;
    await this.mark(target, complete ? 'cached' : 'update', {
      songs: fresh.ids.length,
      cached,
      version: fresh.version,
      reason: complete
        ? ''
        : same
        ? '缓存待补齐'
        : old
        ? '内容有变化'
        : '尚未缓存',
    });
  }
  async nativeTask(command) {
    const native = window.YesPlayMusicAndroid;
    this.guard();
    this.activeDownloadKind = command.kind === 'image' ? 'image' : 'audio';
    this.downloadedBytes = 0;
    this.downloadTotalBytes = 0;
    this.downloadSpeed = 0;
    this.speedSample = null;
    this.taskId = native.cacheLibraryMedia(JSON.stringify(command));
    if (!this.taskId) throw new Error('本地缓存任务仍在结束，请稍后继续');
    try {
      while (this.current()) {
        await this.waitIfPaused();
        const result = JSON.parse(native.getLibraryCacheTask(this.taskId));
        if (result.phase) this.stage = result.phase;
        if (result.current) this.currentSong = result.current;
        this.networkPending = Boolean(result.networkPending);
        if (result.bytes !== undefined)
          this.updateDownload(result.bytes, result.totalBytes, result.kind);
        if (result.state === 'done') return true;
        if (result.state === 'unavailable') return false;
        if (result.state !== 'running')
          throw new Error(result.message || '缓存任务已停止');
        await sleep(300);
      }
      native.stopLibraryCacheTask(this.taskId);
      throw new Error('任务已停止');
    } finally {
      this.taskId = '';
      this.networkPending = false;
    }
  }
  hasPicture(url) {
    if (!url) return true;
    const native = window.YesPlayMusicAndroid;
    if (native?.hasLibraryArtwork) return native.hasLibraryArtwork(url);
    const bridge = artworkBridge();
    const address = new URL(url);
    for (const size of [1024, 224]) {
      address.searchParams.set('param', `${size}y${size}`);
      const cached = bridge?.lookup(address.href);
      if (cached && cached !== address.href) return true;
    }
    return false;
  }
  async picture(url) {
    if (!url) return false;
    this.stage = '检查封面缓存';
    this.setPhase(
      '检查封面缓存',
      this.currentTargetImagesTotal,
      this.currentTargetImagesDone
    );
    if (this.hasPicture(url)) return true;
    const bridge = artworkBridge();
    bridge.allowLibraryArtwork(JSON.stringify([url]));
    this.stage = '缓存封面';
    this.setPhase(
      '缓存封面',
      this.currentTargetImagesTotal,
      this.currentTargetImagesDone
    );
    this.activeDownloadKind = 'image';
    if (window.YesPlayMusicAndroid) {
      await this.governor.before(() => this.current(), false);
      try {
        return await this.nativeTask({ kind: 'image', url });
      } catch (error) {
        if (error.message === '图片缓存失败') return false;
        throw error;
      }
    }
    const address = new URL(url);
    address.searchParams.set('param', '1024y1024');
    if (bridge.lookup(address.href) !== address.href) return true;
    await this.governor.before(() => this.current(), false);
    const onDownloadProgress = event => {
      this.stage = this.paused ? '当前文件完成后暂停' : '下载封面';
      this.networkPending = false;
      this.updateDownload(event.loaded, event.total, 'image');
    };
    this.stage = '下载封面';
    this.updateDownload(0, 0);
    this.networkPending = true;
    try {
      return !!(await bridge.remember(address.href, true, onDownloadProgress));
    } catch (_) {
      address.searchParams.set('param', '224y224');
      this.stage = '下载封面';
      this.networkPending = true;
      this.updateDownload(0, 0, 'image');
      try {
        return !!(await bridge.remember(
          address.href,
          true,
          onDownloadProgress
        ));
      } catch (_) {
        return false;
      }
    } finally {
      this.networkPending = false;
    }
  }
  async song(track) {
    const native = window.YesPlayMusicAndroid;
    this.activeDownloadKind = 'audio';
    await this.waitIfPaused();
    this.stage = '等待接口请求间隔';
    await this.governor.before(
      () => this.current(),
      true,
      () => {
        this.stage = '等待接口请求间隔';
      }
    );
    await this.waitIfPaused();
    this.stage = '请求歌曲音源';
    if (native) return this.nativeTask({ kind: 'audio', id: String(track.id) });
    this.networkPending = true;
    let response;
    try {
      response = await request({
        url: '/song/url/v1',
        params: {
          id: track.id,
          level: musicQualityLevel(this.store.state.settings.musicQuality),
        },
        signal: this.controller.signal,
        skipAuthRedirect: true,
      });
    } finally {
      this.networkPending = false;
    }
    await this.waitIfPaused();
    this.guard();
    if (riskResponse(response))
      this.governor.trip('音乐接口限制请求，已停止并进入冷却');
    if (response?.code !== 200)
      throw new Error(response?.message || '音乐接口请求失败');
    const source = response?.data?.[0];
    if (!source?.url || source.freeTrialInfo) return false;
    this.stage = '下载音乐';
    this.updateDownload(0, Number(source.size) || 0);
    await cacheTrackSource(track, source.url, source.br, 'netease', {
      manual: true,
      current: () => this.current(),
      expectedSize: Number(source.size) || 0,
      requestedLevel: musicQualityLevel(this.store.state.settings.musicQuality),
      signal: this.controller.signal,
      onDownloadProgress: event => {
        this.stage = this.paused ? '当前文件完成后暂停' : '下载音乐';
        this.updateDownload(event.loaded, event.total || source.size);
      },
    });
    await this.waitIfPaused();
    this.stage = '写入音乐缓存';
    return true;
  }
  async update(target) {
    this.stage = '读取收藏歌曲清单';
    this.setPhase('读取歌单或专辑内容');
    const data = await this.snapshot(target),
      fresh = manifest(target, data);
    this.guard();
    this.updateTargetProgress(0.1);
    this.songTotal += fresh.ids.length;
    const previous =
      target.type === 'album'
        ? await getAlbumFromCache(target.id)
        : await getCachedPlaylist(target.id, this.scope);
    this.stage = '读取本地歌曲信息';
    this.setPhase('读取本地歌曲信息', fresh.ids.length, 0);
    const details = new Map(
      (await getSavedTrackDetails(fresh.ids)).map(song => [
        String(song.id),
        song,
      ])
    );
    mapTrackPlayableStatus(fresh.songs, data.privileges || []).forEach(song =>
      details.set(String(song.id), song)
    );
    const missing = fresh.ids.filter(id => !details.has(id));
    this.detailsTotal += fresh.ids.length;
    this.detailsLoaded += Math.min(fresh.ids.length, details.size);
    this.phaseProgress = details.size;
    this.updateTargetProgress(
      0.1 + (fresh.ids.length ? (0.15 * details.size) / fresh.ids.length : 0.15)
    );
    this.stage = missing.length ? '补齐歌曲信息' : '歌曲信息已完整';
    this.setPhase(
      missing.length ? '补齐歌曲信息' : '歌曲信息已完整',
      missing.length || fresh.ids.length,
      missing.length ? 0 : details.size
    );
    let fetchedDetails = 0;
    for (let offset = 0; offset < missing.length; offset += 50) {
      const page = await this.api('/song/detail', {
        ids: missing.slice(offset, offset + 50).join(','),
      });
      if (!Array.isArray(page.songs))
        throw new Error('歌曲内容不完整，已保留旧缓存');
      mapTrackPlayableStatus(page.songs, page.privileges || []).forEach(song =>
        details.set(String(song.id), song)
      );
      const loaded = Math.min(
        missing.length,
        fetchedDetails + page.songs.length
      );
      fetchedDetails = loaded;
      this.detailsLoaded = Math.min(
        this.detailsTotal,
        this.detailsLoaded + page.songs.length
      );
      this.phaseProgress = Math.min(offset + 50, missing.length);
      this.updateTargetProgress(
        0.25 + (missing.length ? (0.1 * loaded) / missing.length : 0.1)
      );
    }
    this.phaseProgress = missing.length || fresh.ids.length;
    this.updateTargetProgress(0.35);
    const oldTracks =
      target.type === 'album'
        ? previous?.songs || []
        : [
            ...(previous?.playlist?.tracks || []),
            ...(previous?.playlist?.archivedTracks || []),
          ];
    // Only a complete, successful ID list can mark an entry missing. Never erase it.
    const merged = await retainTracks(
      fresh.ids.map(id => details.get(id)).filter(Boolean),
      oldTracks,
      fresh.ids
    );
    this.guard();
    this.stage = '保存歌曲信息';
    this.setPhase('保存歌曲信息', merged.length, 0);
    let savedDetails = 0;
    for (const song of merged) {
      await cacheTrackDetail(song, song.privilege);
      this.phaseProgress = ++savedDetails;
      this.updateTargetProgress(
        0.35 + (merged.length ? (0.05 * savedDetails) / merged.length : 0.05)
      );
    }
    if (target.type === 'album') {
      data.songs = merged;
      await cacheAlbum(target.id, data);
    } else {
      data.playlist.tracks = merged.filter(song => !song.archiveStatus);
      data.playlist.archivedTracks = merged.filter(song => song.archiveStatus);
      await savePlaylistSnapshot(target.id, data, this.scope);
    }
    let images = 0,
      cached = 0,
      unavailable = fresh.ids.filter(id => !details.has(id)).length;
    const mergedById = new Map(merged.map(song => [String(song.id), song]));
    const imageUrls = new Set(
      [
        fresh.cover || target.cover,
        ...merged.map(song => song.al?.picUrl || song.album?.picUrl),
      ].filter(Boolean)
    );
    this.imagesTotal += imageUrls.size;
    this.currentTargetImagesDone = 0;
    this.currentTargetImagesTotal = imageUrls.size;
    this.currentTargetSongsDone = 0;
    this.currentTargetMediaTotal = fresh.ids.length + imageUrls.size;
    const save = async () => {
      this.guard();
      if (target.type === 'album') await cacheAlbum(target.id, data);
      else await savePlaylistSnapshot(target.id, data, this.scope);
    };
    const seenPictures = new Set();
    const picture = async url => {
      if (!url || seenPictures.has(url)) return;
      seenPictures.add(url);
      this.guard();
      const cachedImage = await this.picture(url);
      if (cachedImage) images++;
      this.currentTargetImagesDone++;
      this.imagesDone++;
      if (cachedImage) this.imagesCached++;
      this.setPhase('处理封面', imageUrls.size, this.currentTargetImagesDone);
      this.updateMediaProgress();
    };
    await this.mark(target, 'partial', {
      songs: fresh.ids.length,
      cached,
      images,
      unavailable,
      version: fresh.version,
      reason: '',
    });
    this.songIndex = 0;
    this.stage = '检查音乐缓存';
    this.setPhase('检查音乐缓存', fresh.ids.length, 0);
    const checkedBefore = this.songChecked;
    const states = await this.audioStates(fresh.ids, checked => {
      this.songChecked = checkedBefore + checked;
      this.phaseProgress = checked;
      this.updateTargetProgress(
        0.4 + (fresh.ids.length ? (0.05 * checked) / fresh.ids.length : 0.05)
      );
    });
    this.songChecked = checkedBefore + fresh.ids.length;
    this.phaseProgress = fresh.ids.length;
    this.updateTargetProgress(0.45);
    if (window.YesPlayMusicAndroid)
      fresh.ids
        .filter(id => states[id] === 2)
        .forEach(id => window.YesPlayMusicAndroid.preserveCachedTrack(id));
    else {
      const pinned = JSON.parse(
        localStorage.getItem('preserved-audio') || '[]'
      );
      localStorage.setItem(
        'preserved-audio',
        JSON.stringify([
          ...new Set([...pinned, ...fresh.ids.filter(id => states[id] === 2)]),
        ])
      );
    }
    try {
      await picture(fresh.cover || target.cover);
      this.stage = '准备缓存歌曲';
      this.setPhase('缓存歌曲', fresh.ids.length, 0);
      for (const id of fresh.ids) {
        this.guard();
        await this.waitIfPaused();
        this.songIndex++;
        this.currentSong = mergedById.get(id)?.name || id;
        this.message = `${target.name} · 音乐 ${cached}/${fresh.ids.length}`;
        const song = mergedById.get(id);
        if (!song) {
          this.songDone++;
          this.currentTargetSongsDone++;
          this.phaseProgress = this.currentTargetSongsDone;
          this.updateMediaProgress();
          continue;
        }
        await picture(song.al?.picUrl || song.album?.picUrl);
        if (states[id] === 2) {
          this.stage = '复用已缓存音乐';
          cached++;
        } else if (await this.song(song)) cached++;
        else {
          unavailable++;
          const preserved = await retainTracks([{ ...song, playable: false }]);
          Object.assign(song, preserved[0]);
          await cacheTrackDetail(song, song.privilege);
        }
        this.songDone++;
        this.currentTargetSongsDone++;
        this.phaseProgress = this.currentTargetSongsDone;
        this.updateMediaProgress();
        this.downloadSpeed = 0;
        this.downloadedBytes = 0;
        this.downloadTotalBytes = 0;
        this.speedSample = null;
        this.activeDownloadKind = '';
        await this.mark(target, 'partial', {
          songs: fresh.ids.length,
          cached,
          images,
          imagesTotal: imageUrls.size,
          unavailable,
          version: fresh.version,
        });
      }
      await this.mark(
        target,
        cached === fresh.ids.length && images === imageUrls.size
          ? 'cached'
          : 'partial',
        {
          songs: fresh.ids.length,
          cached,
          images,
          imagesTotal: imageUrls.size,
          unavailable,
          version: fresh.version,
          reason: unavailable ? '部分歌曲不可用，已保留缓存' : '',
        }
      );
      if (cached !== fresh.ids.length || images !== imageUrls.size)
        this.partialItems++;
      this.updateTargetProgress(1);
    } finally {
      if (this.current()) await save();
    }
  }

  async run(mode, targets) {
    if (this.running || this.starting) return;
    const requestedScope = libraryScope(this.store.state.data);
    this.starting = true;
    this.stopped = false;
    this.paused = false;
    this.message = '';
    this.mode = mode;
    this.progress = 0;
    this.total = 0;
    this.songDone = 0;
    this.songTotal = 0;
    this.songChecked = 0;
    this.imagesDone = 0;
    this.imagesTotal = 0;
    this.imagesCached = 0;
    this.detailsLoaded = 0;
    this.detailsTotal = 0;
    this.songIndex = 0;
    this.currentSong = '';
    this.currentTargetKey = '';
    this.currentTargetFraction = 0;
    this.currentTargetImagesDone = 0;
    this.currentTargetImagesTotal = 0;
    this.currentTargetSongsDone = 0;
    this.currentTargetMediaTotal = 0;
    this.phaseLabel = '';
    this.phaseProgress = 0;
    this.phaseTotal = 0;
    this.networkPending = false;
    this.activeDownloadKind = '';
    this.downloadedBytes = 0;
    this.downloadTotalBytes = 0;
    this.downloadSpeed = 0;
    this.speedSample = null;
    this.failedItems = 0;
    this.unavailableItems = 0;
    this.partialItems = 0;
    this.stage = mode === 'check' ? '准备检查' : '准备缓存';
    this.setPhase('读取本地收藏索引');
    try {
      await this.restore();
    } finally {
      this.starting = false;
    }
    if (this.stopped) {
      this.message = '已取消，已完成缓存保留';
      this.stage = '已取消';
      return;
    }
    if (!this.scope) {
      this.message = '请先登录并打开一次“我的”';
      return;
    }
    if (archiveMode() || navigator.onLine === false) {
      this.message = '离线或纪念模式下保留现有缓存，停止联网更新';
      return;
    }
    if (
      window.YesPlayMusicAndroid &&
      !window.YesPlayMusicAndroid.cacheLibraryMedia
    ) {
      this.message = '请先安装新版安卓应用';
      return;
    }
    if (requestedScope !== this.scope) {
      this.message = '账号已切换，请重新选择缓存内容';
      return;
    }
    const list =
      targets ||
      this.targets().filter(
        target => mode === 'check' || needsCacheUpdate(this.marks[target.key])
      );
    this.running = true;
    this.total = list.length;
    this.stage = mode === 'check' ? '准备检查' : '准备缓存';
    this.startSpeedMonitor();
    this.errors = 0;
    this.quality = this.store.state.settings.musicQuality;
    this.controller = new AbortController();
    this.governor = new CacheGovernor(this.scope, localStorage, ms =>
      this.waitForRequestSlot(ms)
    );
    this.governor.onWait = () => {
      this.stage = '等待接口请求间隔';
    };
    try {
      for (const target of list) {
        await this.waitIfPaused();
        this.guard();
        this.currentTargetKey = target.key;
        this.currentTargetFraction = 0;
        this.currentTargetImagesDone = 0;
        this.currentTargetImagesTotal = 0;
        this.currentTargetSongsDone = 0;
        this.currentTargetMediaTotal = 0;
        this.message = `${mode === 'check' ? '检查' : '缓存'}：${target.name}`;
        try {
          if (mode === 'check') await this.check(target);
          else await this.update(target);
          this.errors = 0;
        } catch (error) {
          if (!this.current()) throw error;
          if (
            riskResponse(error?.response?.data || error) ||
            riskResponse(error)
          )
            this.governor.trip(
              '接口要求验证、登录或限制请求，已停止并进入冷却'
            );
          if (
            /冷却|请求上限|容量|空间不足|音乐接口请求失败/.test(error.message)
          )
            throw error;
          error.unavailable =
            error.unavailable || Number(error?.response?.status) === 404;
          if (error.unavailable) await this.preserve(target);
          if (error.unavailable) this.unavailableItems++;
          else this.failedItems++;
          await this.mark(target, error.unavailable ? 'unavailable' : 'error', {
            reason: error.message,
          });
          if (!error.unavailable && ++this.errors >= 3)
            this.governor.trip(
              '连续请求失败，已暂停 20 分钟；现有缓存全部保留'
            );
        }
        this.updateTargetProgress(1);
        this.progress++;
        this.currentTargetFraction = 0;
      }
      this.message = list.length
        ? `已完成 ${this.progress} 项${
            mode === 'check' ? '检查，需更新的条目已标记' : '缓存任务'
          }${this.failedItems ? `，${this.failedItems} 项失败` : ''}${
            this.unavailableItems ? `，${this.unavailableItems} 项不可见` : ''
          }${this.partialItems ? `，${this.partialItems} 项部分缓存` : ''}`
        : '没有待处理项目';
      this.stage =
        this.failedItems || this.unavailableItems || this.partialItems
          ? '部分完成'
          : '任务完成';
    } catch (error) {
      this.message = this.stopped
        ? '已取消，已完成缓存保留'
        : error.message || '任务中断，现有缓存保留';
      this.stage = this.stopped ? '已取消' : '任务中断';
    } finally {
      this.running = false;
      this.controller = null;
      this.networkPending = false;
      clearTimeout(this.speedTimer);
      this.speedTimer = null;
      if (this.scope !== libraryScope(this.store.state.data))
        await this.restore();
    }
  }
}
export function libraryCacheManager(store) {
  if (!managers.has(store)) managers.set(store, new LibraryCacheManager(store));
  return managers.get(store);
}
