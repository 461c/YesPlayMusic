const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const requests = [];
let raf;
const context = {
  module: { exports: {} },
  navigator: { onLine: true },
  mapState: () => ({}),
  mapActions: () => ({}),
  mapMutations: () => ({}),
  NProgress: { done() {} },
  observePlaylistArtwork() {},
  getCachedPlaylist: async () => null,
  getPlaylistDetail: async () => ({ playlist: fixture(1000, 50) }),
  getTrackDetail: ids =>
    new Promise(resolve => requests.push({ ids: ids.split(','), resolve })),
  requestAnimationFrame: fn => ((raf = fn), 1),
  cancelAnimationFrame() {},
  Cover: {},
  ButtonTwoTone: {},
  TrackList: {},
  Modal: {},
  ContextMenu: {},
};
const code = fs
  .readFileSync('src/views/playlist.vue', 'utf8')
  .split('<script>')[1]
  .split('</script>')[0]
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace('export default', 'module.exports =');
vm.runInNewContext(code, context);
const component = context.module.exports;
function fixture(total, details) {
  return {
    id: 1,
    trackIds: Array.from({ length: total }, (_, i) => ({ id: i + 1 })),
    tracks: Array.from({ length: details }, (_, i) => ({
      id: i + 1,
      name: 'Song ' + i,
      al: {},
      ar: [],
    })),
  };
}
function page() {
  const p = {
    ...component.data(),
    $refs: {
      loadMoreTrigger: {
        getBoundingClientRect: () => ({ top: 500, bottom: 530 }),
      },
    },
    $parent: {
      $refs: {
        main: { getBoundingClientRect: () => ({ top: 0, bottom: 800 }) },
      },
    },
  };
  for (const [key, fn] of Object.entries(component.methods))
    p[key] = fn.bind(p);
  return p;
}
(async () => {
  const cached = page();
  cached.applyPlaylist({ playlist: fixture(1000, 1000) });
  assert.equal(cached.tracks.length, 50);
  assert.equal(requests.length, 0);
  await cached.loadMore();
  assert.equal(cached.tracks.length, 100);
  assert.equal(
    requests.length,
    0,
    'Reuse saved metadata without extra API calls'
  );
  const p = page();
  await p.loadData(1);
  assert.equal(p.show, true);
  assert.equal(p.tracks.length, 50);
  assert.equal(requests.length, 0, 'No eager requests beyond the first 50');
  p.onPlaylistScroll();
  raf();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].ids.length, 50);
  requests[0].resolve({
    songs: requests[0].ids.map(id => ({ id: Number(id) })),
  });
  await new Promise(r => setImmediate(r));
  assert.equal(p.tracks.length, 100);
  const pending = p.loadMore();
  assert.equal(requests[1].ids.length, 50);
  p.loadGeneration++;
  p.applyPlaylist({ playlist: fixture(4, 4) });
  requests[1].resolve({ songs: [{ id: 999 }] });
  await pending;
  assert.equal(
    p.tracks.length,
    4,
    'Ignore pagination from previous navigation'
  );
  const apiContext = {
    module: { exports: {} },
    request: async config =>
      config.url === '/user/detail'
        ? {
            code: 200,
            profile: {
              backgroundUrl:
                'https://p1.music.126.net/default/109951162868128395.jpg',
            },
          }
        : {
            code: 200,
            data: {
              profile: {
                backgroundUrl: 'http://p2.music.126.net/custom/123456.jpg',
              },
            },
          },
  };
  vm.runInNewContext(
    fs
      .readFileSync('src/api/tracking.js', 'utf8')
      .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
      .replace(/export /g, '') + '\nmodule.exports={readTrackingSection};',
    apiContext
  );
  const profile = await apiContext.module.exports.readTrackingSection(
    '1',
    'profile'
  );
  assert.equal(
    profile.profile.backgroundUrl,
    'https://p2.music.126.net/custom/123456.jpg'
  );
  assert.equal(profile.profile.backgroundCandidates.length, 1);
  console.log(
    'Playlist: first 50, cached batches, scroll-only pagination and navigation races; mobile background candidates passed'
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
