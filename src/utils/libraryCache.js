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
export class CacheGovernor {
  constructor(
    scope,
    storage = localStorage,
    wait = sleep,
    random = Math.random
  ) {
    this.key = 'library-cache-cooldown:' + scope;
    this.storage = storage;
    this.wait = wait;
    this.random = random;
    let budget = {};
    try {
      budget = JSON.parse(storage.getItem(this.key + ':budget') || '{}');
    } catch (_) {
      /* Optional storage. */
    }
    this.since = budget.since || Date.now();
    this.requests =
      Date.now() - this.since < 20 * 60000 ? Number(budget.requests) || 0 : 0;
    if (!this.requests) this.since = Date.now();
    this.last = Number(storage.getItem(this.key + ':last')) || 0;
  }
  trip(message) {
    this.storage.setItem(this.key, String(Date.now() + 20 * 60000));
    throw new Error(message);
  }
  async before(current, accountRequest = true) {
    if (!current()) throw new Error('任务已停止');
    if (Number(this.storage.getItem(this.key)) > Date.now())
      throw new Error('更新已冷却暂停，请稍后再手动继续');
    if (accountRequest && this.requests >= 100)
      this.trip('已达到本次 100 次请求上限，暂停 20 分钟；已完成的缓存会保留');
    const delay = this.last
      ? Math.max(
          0,
          this.last +
            (accountRequest ? 1800 : 500) +
            this.random() * (accountRequest ? 2200 : 500) -
            Date.now()
        ) +
        (accountRequest && this.requests && this.requests % 20 === 0 ? 8000 : 0)
      : 0;
    // Short waits let Stop/account changes take effect immediately between requests.
    for (let left = delay; left > 0; left -= 200) {
      if (!current()) throw new Error('任务已停止');
      await this.wait(Math.min(200, left));
    }
    if (!current()) throw new Error('任务已停止');
    if (accountRequest) {
      this.requests++;
      this.storage.setItem(
        this.key + ':budget',
        JSON.stringify({ since: this.since, requests: this.requests })
      );
    }
    this.last = Date.now();
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
    this.controller?.abort();
    if (this.taskId)
      window.YesPlayMusicAndroid?.stopLibraryCacheTask?.(this.taskId);
    this.message = '正在停止，保留已完成的缓存';
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
    await this.governor.before(() => this.current());
    const data = await request({
      url,
      params: { ...params, timestamp: Date.now() },
      signal: this.controller.signal,
      skipAuthRedirect: true,
    });
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
  async audioStates(ids) {
    const native = window.YesPlayMusicAndroid;
    const states = {};
    if (native?.getLibraryAudioStates) {
      for (let start = 0; start < ids.length; start += 200)
        Object.assign(
          states,
          JSON.parse(
            native.getLibraryAudioStates(
              JSON.stringify(ids.slice(start, start + 200))
            )
          )
        );
    } else
      for (const id of ids) {
        const cached = await getTrackSource(id);
        states[id] =
          cached?.source?.byteLength &&
          (!cached.requestedLevel ||
            cached.requestedLevel ===
              musicQualityLevel(this.store.state.settings.musicQuality))
            ? 2
            : 0;
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
    this.snapshots.delete(target.key);
    const data = await this.snapshot(target),
      fresh = manifest(target, data);
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
    const states = await this.audioStates(fresh.ids);
    const cached = fresh.ids.filter(id => states[id] === 2).length;
    const last = this.marks[target.key];
    const details = new Map(
      (await getSavedTrackDetails(fresh.ids)).map(song => [
        String(song.id),
        song,
      ])
    );
    mapTrackPlayableStatus(fresh.songs, data.privileges || []).forEach(song =>
      details.set(String(song.id), song)
    );
    const images = [
      fresh.cover || target.cover,
      ...[...details.values()].map(
        song => song.al?.picUrl || song.album?.picUrl
      ),
    ].filter(Boolean);
    const allImages =
      details.size >= fresh.ids.length &&
      images.every(url => this.hasPicture(url));
    await this.mark(
      target,
      same &&
        cached === fresh.ids.length &&
        allImages &&
        last?.status === 'cached' &&
        last.version === fresh.version
        ? 'cached'
        : 'update',
      {
        songs: fresh.ids.length,
        cached,
        version: fresh.version,
        reason: same ? '缓存待补齐' : old ? '内容有变化' : '尚未缓存',
      }
    );
  }
  async nativeTask(command) {
    const native = window.YesPlayMusicAndroid;
    this.guard();
    this.taskId = native.cacheLibraryMedia(JSON.stringify(command));
    if (!this.taskId) throw new Error('本地缓存任务仍在结束，请稍后继续');
    try {
      while (this.current()) {
        const result = JSON.parse(native.getLibraryCacheTask(this.taskId));
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
    if (this.hasPicture(url)) return true;
    const bridge = artworkBridge();
    bridge.allowLibraryArtwork(JSON.stringify([url]));
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
    try {
      return !!(await bridge.remember(address.href, true));
    } catch (_) {
      address.searchParams.set('param', '224y224');
      try {
        return !!(await bridge.remember(address.href, true));
      } catch (_) {
        return false;
      }
    }
  }
  async song(track) {
    const native = window.YesPlayMusicAndroid;
    await this.governor.before(() => this.current());
    if (native) return this.nativeTask({ kind: 'audio', id: String(track.id) });
    const response = await request({
      url: '/song/url/v1',
      params: {
        id: track.id,
        level: musicQualityLevel(this.store.state.settings.musicQuality),
      },
      signal: this.controller.signal,
      skipAuthRedirect: true,
    });
    this.guard();
    if (riskResponse(response))
      this.governor.trip('音乐接口限制请求，已停止并进入冷却');
    if (response?.code !== 200)
      throw new Error(response?.message || '音乐接口请求失败');
    const source = response?.data?.[0];
    if (!source?.url || source.freeTrialInfo) return false;
    await cacheTrackSource(track, source.url, source.br, 'netease', {
      manual: true,
      current: () => this.current(),
      expectedSize: Number(source.size) || 0,
      requestedLevel: musicQualityLevel(this.store.state.settings.musicQuality),
      signal: this.controller.signal,
    });
    return true;
  }
  async update(target) {
    const data = await this.snapshot(target),
      fresh = manifest(target, data);
    this.guard();
    const previous =
      target.type === 'album'
        ? await getAlbumFromCache(target.id)
        : await getCachedPlaylist(target.id, this.scope);
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
    for (let offset = 0; offset < missing.length; offset += 50) {
      const page = await this.api('/song/detail', {
        ids: missing.slice(offset, offset + 50).join(','),
      });
      if (!Array.isArray(page.songs))
        throw new Error('歌曲内容不完整，已保留旧缓存');
      mapTrackPlayableStatus(page.songs, page.privileges || []).forEach(song =>
        details.set(String(song.id), song)
      );
    }
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
    for (const song of merged) await cacheTrackDetail(song, song.privilege);
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
    const imageUrls = new Set();
    const mergedById = new Map(merged.map(song => [String(song.id), song]));
    const save = async () => {
      this.guard();
      if (target.type === 'album') await cacheAlbum(target.id, data);
      else await savePlaylistSnapshot(target.id, data, this.scope);
    };
    const picture = async url => {
      if (!url || imageUrls.has(url)) return;
      imageUrls.add(url);
      this.guard();
      if (await this.picture(url)) images++;
    };
    await this.mark(target, 'partial', {
      songs: fresh.ids.length,
      cached,
      images,
      unavailable,
      version: fresh.version,
      reason: '',
    });
    const states = await this.audioStates(fresh.ids);
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
      for (const id of fresh.ids) {
        this.guard();
        this.message = `${target.name} · 音乐 ${cached}/${fresh.ids.length}`;
        const song = mergedById.get(id);
        if (!song) continue;
        await picture(song.al?.picUrl || song.album?.picUrl);
        if (states[id] === 2) cached++;
        else if (await this.song(song)) cached++;
        else {
          unavailable++;
          const preserved = await retainTracks([{ ...song, playable: false }]);
          Object.assign(song, preserved[0]);
          await cacheTrackDetail(song, song.privilege);
        }
        await this.mark(target, 'partial', {
          songs: fresh.ids.length,
          cached,
          images,
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
          unavailable,
          version: fresh.version,
          reason: unavailable ? '部分歌曲不可用，已保留缓存' : '',
        }
      );
    } finally {
      if (this.current()) await save();
    }
  }

  async run(mode, targets) {
    if (this.running || this.starting) return;
    const requestedScope = libraryScope(this.store.state.data);
    this.starting = true;
    try {
      await this.restore();
    } finally {
      this.starting = false;
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
        target =>
          mode === 'check' || this.marks[target.key]?.status !== 'cached'
      );
    this.running = true;
    this.stopped = false;
    this.progress = 0;
    this.total = list.length;
    this.errors = 0;
    this.quality = this.store.state.settings.musicQuality;
    this.controller = new AbortController();
    this.governor = new CacheGovernor(this.scope);
    try {
      for (const target of list) {
        this.guard();
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
          await this.mark(target, error.unavailable ? 'unavailable' : 'error', {
            reason: error.message,
          });
          if (!error.unavailable && ++this.errors >= 3)
            this.governor.trip(
              '连续请求失败，已暂停 20 分钟；现有缓存全部保留'
            );
        }
        this.progress++;
      }
      this.message = list.length
        ? `已完成 ${this.progress} 项${
            mode === 'check' ? '检查，需更新的条目已标记' : '缓存任务'
          }`
        : '没有待处理项目';
    } catch (error) {
      this.message = this.stopped
        ? '已停止，保留已完成的缓存'
        : error.message || '任务中断，现有缓存保留';
    } finally {
      this.running = false;
      this.controller = null;
      if (this.scope !== libraryScope(this.store.state.data))
        await this.restore();
    }
  }
}
export function libraryCacheManager(store) {
  if (!managers.has(store)) managers.set(store, new LibraryCacheManager(store));
  return managers.get(store);
}
