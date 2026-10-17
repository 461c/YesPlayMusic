const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
function load(path, names, globals = {}) {
  const source = fs
    .readFileSync(path, 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/export default ([^;]+);?/g, '')
    .replace(/export /g, '');
  const context = { module: { exports: {} }, ...globals };
  vm.runInNewContext(source + '\nmodule.exports={' + names + '};', context);
  return context.module.exports;
}
const { mergeTrackingEvents } = load(
  'src/utils/trackingEvents.js',
  'mergeTrackingEvents'
);
const event = (id, eventTime, extra = {}) => ({
  id,
  eventTime,
  json: JSON.stringify({ msg: 'Memory ' + id }),
  pics: [{ originUrl: 'photo-' + id }],
  ...extra,
});
const old = { events: [event(1, 100), event(2, 200), event(3, 300)] };
const refresh = mergeTrackingEvents(old, {
  events: [event(4, 400), event(2, 200, { json: '{"msg":"Updated"}' })],
  more: true,
  lasttime: 200,
});
assert.equal(refresh.events.map(item => item.id).join(','), '4,3,2,1');
assert.equal(
  refresh.events.find(item => item.id === 3).archiveStatus,
  'unavailable'
);
assert.equal(
  refresh.events.find(item => item.id === 1).archiveStatus,
  undefined,
  'Unvisited older pages are not deleted'
);
assert.equal(
  refresh.events.find(item => item.id === 3).pics[0].originUrl,
  'photo-3'
);
assert.equal(
  old.events[2].archiveStatus,
  undefined,
  'Do not mutate the previous persisted snapshot'
);
const page = mergeTrackingEvents(
  refresh,
  { events: [event(1, 100)], more: false, lasttime: 100 },
  { lasttime: 200 }
);
assert.equal(page.events.length, 4);
assert.equal(
  page.events.find(item => item.id === 4).archiveStatus,
  undefined,
  'Pagination must not mark newer events missing'
);
assert.equal(
  page.events.find(item => item.id === 2).archiveStatus,
  'unavailable'
);
const restored = mergeTrackingEvents(page, {
  events: [event(3, 300)],
  more: true,
  lasttime: 300,
});
assert.equal(
  restored.events.find(item => item.id === 3).archiveStatus,
  undefined,
  'A reappearing event clears its tombstone'
);
const empty = mergeTrackingEvents(old, { events: [], more: false });
assert.equal(
  empty.events.length,
  3,
  'A successful empty response must retain every memory'
);
assert(empty.events.every(item => item.archiveStatus));
const incomplete = mergeTrackingEvents(old, { events: [], more: true });
assert(incomplete.events.every(item => !item.archiveStatus));
const { searchLibrary, libraryTrackIds } = load(
  'src/utils/librarySearch.js',
  'searchLibrary,libraryTrackIds'
);
const liked = {
  playlists: [
    { id: 10, name: '我的摇滚', creator: { nickname: 'Me' } },
    { id: 20, name: '夜晚', creator: { nickname: 'Other' } },
    { id: 30, name: '未打开' },
  ],
  songs: [1],
  songsWithDetails: [{ id: 1, name: 'Alpha', ar: [{ name: 'Band' }] }],
  albums: [{ id: 2, name: 'Album', artists: [{ name: 'Band' }] }],
  artists: [{ id: 4, name: 'Band', alias: ['乐队'] }],
  mvs: [{ id: 5, name: 'Film', artistName: 'Band' }],
  cloudDisk: [{ songId: 6, songName: 'Cloud', artist: 'Singer' }],
};
const saved = [
  {
    playlist: {
      id: 10,
      name: 'old title',
      tracks: [
        { id: 1, name: 'Alpha', ar: [{ name: 'Band' }], al: { name: 'Album' } },
      ],
      trackIds: [{ id: 1 }, { id: 2 }],
    },
  },
  {
    playlist: {
      id: 20,
      name: '夜晚',
      tracks: [{ id: 1, name: 'Alpha', ar: [{ name: 'Band' }] }],
      trackIds: [{ id: 1 }],
    },
  },
  {
    playlist: {
      id: 999,
      name: '不属于音乐库',
      tracks: [{ id: 99, name: 'Alpha' }],
      trackIds: [{ id: 99 }],
    },
  },
];
const tracks = [
  { id: 2, name: 'Beta', al: { name: 'Album' }, ar: [{ name: 'Band' }] },
];
let results = searchLibrary(liked, saved, tracks, 'alpha band');
assert.equal(results.songs.length, 1);
assert.equal(
  results.songs[0].sources.length,
  3,
  'One song retains all playlist and liked-list memberships'
);
assert.equal(
  results.songs[0].sources[0].name,
  '我的摇滚',
  'Current library titles win'
);
results = searchLibrary(liked, saved, tracks, '我的摇滚');
assert.equal(results.playlists.length, 1);
assert.equal(
  results.songs.length,
  2,
  'Searching a playlist name finds its saved tracks including paginated details'
);
assert.equal(searchLibrary(liked, saved, tracks, '乐队').artists.length, 1);
assert.equal(searchLibrary(liked, saved, tracks, 'cloud').songs[0].song.id, 6);
assert.equal(
  libraryTrackIds(liked, saved).sort().join(','),
  '1,2',
  'Never include unrelated cached playlist tracks'
);
assert.equal(results.coverage.saved, 2);
assert.equal(results.coverage.total, 3);
assert.equal(searchLibrary(liked, saved, tracks, 'not-here').songs.length, 0);
let settings = { archiveMode: true };
const { archiveMode, archiveError } = load(
  'src/utils/archiveMode.js',
  'archiveMode,archiveError',
  { localStorage: { getItem: () => JSON.stringify(settings) } }
);
const { cachedResource } = load(
  'src/utils/cachedResource.js',
  'cachedResource',
  { archiveMode, archiveError, navigator: { onLine: true } }
);
(async () => {
  let requests = 0;
  assert.equal(
    await cachedResource(
      () => 42,
      () => {
        requests++;
      }
    ),
    42
  );
  await assert.rejects(
    cachedResource(
      () => null,
      () => {
        requests++;
      }
    ),
    /纪念模式/
  );
  assert.equal(
    requests,
    0,
    'Archive browsing must not start even a background refresh'
  );
  const handlers = {};
  const service = {
    interceptors: {
      request: { use: fn => (handlers.before = fn) },
      response: {
        use: (good, bad) => {
          handlers.good = good;
          handlers.bad = bad;
        },
      },
    },
  };
  load('src/utils/request.js', 'service', {
    axios: { create: () => service },
    archiveMode,
    archiveError,
    process: { env: { VUE_APP_NETEASE_API_URL: '/api' } },
    isAndroid: false,
    localStorage: {
      getItem: () => JSON.stringify({ proxyConfig: {}, ...settings }),
    },
    getCookie: () => null,
    console: { warn() {}, error() {} },
  });
  assert.throws(() => handlers.before({ url: '/user/detail' }), /纪念模式/);
  assert.throws(
    () => handlers.good({ data: { code: 200 } }),
    /纪念模式/,
    'Late responses after freezing cannot overwrite saved data'
  );
  settings.archiveMode = false;
  assert.equal(
    handlers.before({ url: '/user/detail' }).params.realIP,
    '211.161.244.70'
  );
  await assert.rejects(
    handlers.bad({
      response: { data: { code: 301, msg: '需要登录' } },
      config: {},
    })
  );
  const native = fs.readFileSync(
    'android/app/src/main/java/com/yesplaymusic/tablet/AudioCache.java',
    'utf8'
  );
  assert(native.includes('return Long.MAX_VALUE'));
  assert(native.includes('纪念模式：此歌曲没有完整本地缓存'));
  const photos = fs.readFileSync(
    'android/app/src/main/java/com/yesplaymusic/tablet/MainActivity.java',
    'utf8'
  );
  assert(photos.includes('Intent.ACTION_CREATE_DOCUMENT'));
  assert(photos.includes('window.__closePhotoLightbox'));
  console.log(
    'Archive/library: chronological tombstones, pagination, reappearance, preserved photos, scoped local search and ownership, cache-only reads, late-response freeze and no automatic logout passed'
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
