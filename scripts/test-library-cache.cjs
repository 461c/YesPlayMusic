const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
let now = 1000000;
class Clock extends Date {
  static now() {
    return now;
  }
}
const values = new Map();
const storage = {
  getItem: key => values.get(key),
  setItem: (key, value) => values.set(key, value),
};
const records = [],
  native = [],
  snapshots = [];
let response = {
  code: 200,
  playlist: {
    id: 1,
    name: 'List',
    trackIds: [{ id: 2 }],
    tracks: [{ id: 2, name: 'New', al: {} }],
  },
};
class Dexie {
  constructor() {
    this.checks = {
      put: async row => records.push(row),
      where: () => ({ equals: () => ({ toArray: async () => [] }) }),
    };
  }
  version() {
    return { stores() {} };
  }
}
const context = {
  module: { exports: {} },
  Date: Clock,
  localStorage: storage,
  Vue: { set: (obj, key, value) => (obj[key] = value) },
  Dexie,
  libraryScope: data => String(data.user?.userId || ''),
  archiveMode: () => false,
  window: {
    YesPlayMusicAndroid: {
      preserveCachedTrack: id => {
        native.push(id);
        return 2;
      },
      getLibraryAudioStates: json =>
        JSON.stringify(Object.fromEntries(JSON.parse(json).map(id => [id, 0]))),
    },
  },
  navigator: { onLine: true },
  getCachedPlaylist: async () => ({
    playlist: {
      id: 1,
      name: 'Old',
      trackIds: [{ id: 2 }, { id: 9 }],
      tracks: [{ id: 9, name: 'Memory' }],
    },
  }),
  getAlbumFromCache: async () => null,
  getSavedTrackDetails: async () => [],
  getTrackSource: async () => null,
  cacheTrackDetail: async () => {},
  savePlaylistSnapshot: async (id, data) =>
    snapshots.push(JSON.parse(JSON.stringify(data))),
  cacheAlbum: async (id, data) =>
    snapshots.push(JSON.parse(JSON.stringify(data))),
  cacheTrackSource: async () => {
    throw new Error('Complete audio must be reused');
  },
  mapTrackPlayableStatus: songs => songs,
  request: async () => response,
  setTimeout,
  clearTimeout,
  AbortController,
};
context.retainTracks = vm.runInNewContext(
  fs
    .readFileSync('src/utils/retainedTracks.js', 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/export /g, '') + '\nretainTracks;',
  context
);
vm.runInNewContext(
  fs
    .readFileSync('src/utils/libraryCache.js', 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/export /g, '') +
    '\nmodule.exports={cacheTargets,manifest,CacheGovernor,riskResponse,libraryCacheManager};',
  context
);
const {
  cacheTargets,
  manifest,
  CacheGovernor,
  riskResponse,
  libraryCacheManager,
} = context.module.exports;
const state = {
  data: { user: { userId: 1 }, likedSongPlaylistID: 10 },
  liked: {
    playlists: [
      { id: 10, name: 'Liked', creator: { userId: 1 } },
      { id: 11, name: 'Created', creator: { userId: 1 } },
      {
        id: 12,
        name: 'Saved',
        creator: { userId: 5 },
        archiveStatus: 'removed',
      },
    ],
    albums: [{ id: 20, name: 'Album' }],
  },
  settings: { musicQuality: 'flac' },
};
assert.equal(
  cacheTargets(state)
    .map(item => item.group)
    .join(','),
  'likes,created,saved,albums'
);
assert.equal(cacheTargets(state)[2].archiveStatus, 'removed');
const target = { id: 1, key: 'playlist:1', type: 'playlist', name: 'List' };
assert.throws(() => manifest(target, { playlist: { id: 1 } }), /不完整/);
const album = { type: 'album' };
assert.equal(
  manifest(album, {
    album: { name: 'A' },
    songs: [{ id: 1 }, { id: 2, archiveStatus: 'removed' }],
  }).ids.join(','),
  '1'
);
assert(riskResponse({ response: { status: 429 } }));
assert(riskResponse({ code: -462 }));
assert(riskResponse({ message: '音乐接口请求失败（HTTP 403）' }));
(async () => {
  const scope = 'test';
  const governor = new CacheGovernor(
    scope,
    storage,
    async ms => {
      now += ms;
    },
    () => 0
  );
  await governor.before(() => true);
  const first = now;
  await governor.before(() => true);
  assert(now - first >= 1800);
  await assert.rejects(
    governor.before(() => false),
    /停止/
  );
  assert.equal(
    new CacheGovernor(scope, storage).requests,
    2,
    'Restarting a task must not reset the request budget'
  );
  governor.requests = 100;
  await assert.rejects(
    governor.before(() => true),
    /上限/
  );
  await assert.rejects(
    new CacheGovernor(scope, storage).before(() => true),
    /冷却/
  );
  const store = { state, dispatch: async () => {} };
  const manager = libraryCacheManager(store);
  manager.scope = '1';
  manager.controller = new AbortController();
  manager.governor = new CacheGovernor(
    'metadata',
    storage,
    async ms => {
      now += ms;
    },
    () => 0
  );
  await manager.check(target);
  assert.equal(manager.marks[target.key].status, 'update');
  assert.equal(
    records.length,
    1,
    'Check writes one scoped per-collection mark, not an audio task'
  );
  assert.equal(
    native.length,
    0,
    'Checking must never download or change playback'
  );
  await manager.preserve(target);
  assert.equal(
    native.join(','),
    '2,9',
    'Unavailable collections pin existing songs without deleting metadata'
  );
  manager.audioStates = async () => ({ 2: 2 });
  await manager.update(target);
  assert.equal(manager.marks[target.key].status, 'cached');
  assert.equal(snapshots[0].playlist.archivedTracks[0].name, 'Memory');
  assert.equal(
    snapshots[0].playlist.archivedTracks[0].archiveStatus,
    'removed'
  );
  let active = 0,
    peak = 0,
    songs = 0;
  manager.song = async () => {
    active++;
    peak = Math.max(peak, active);
    await Promise.resolve();
    active--;
    songs++;
    return true;
  };
  response = {
    code: 200,
    album: { id: 20, name: 'Album' },
    songs: [
      { id: 3, name: 'Three', al: {} },
      { id: 4, name: 'Four', al: {} },
    ],
  };
  await manager.update({
    id: 20,
    key: 'album:20',
    type: 'album',
    name: 'Album',
  });
  assert.equal(peak, 1, 'Manual songs must cache strictly one at a time');
  assert.equal(songs, 2);
  let cancelled = 0;
  context.window.YesPlayMusicAndroid.cacheLibraryMedia = () => 'task';
  context.window.YesPlayMusicAndroid.stopLibraryCacheTask = () => cancelled++;
  context.window.YesPlayMusicAndroid.getLibraryCacheTask = () =>
    JSON.stringify({ state: 'done' });
  assert.equal(await manager.nativeTask({ kind: 'audio', id: '3' }), true);
  assert.equal(manager.taskId, '');
  context.window.YesPlayMusicAndroid.getLibraryCacheTask = () => {
    manager.stopped = true;
    return JSON.stringify({ state: 'running' });
  };
  await assert.rejects(manager.nativeTask({ kind: 'audio', id: '4' }), /停止/);
  assert.equal(
    cancelled,
    1,
    'Stopping a polling task must cancel its native writer'
  );
  assert.equal(manager.taskId, '');
  manager.stopped = false;
  const oldMark = manager.marks[target.key].status;
  response = { code: 403, message: '访问频繁' };
  await assert.rejects(manager.api('/playlist/detail', { id: 1 }), /冷却/);
  assert.equal(
    manager.marks[target.key].status,
    oldMark,
    'Blocked API must not erase the previous mark or cached content'
  );
  console.log(
    'Manual library cache: grouping, tombstones, serial pacing, cancellation, persisted budget/cooldown, per-item checks and preservation passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
