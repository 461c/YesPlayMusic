const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let now = Date.UTC(2026, 9, 16, 21, 59);
class Clock extends Date {
  static now() {
    return now;
  }
}
const storage = new Map(),
  requests = [];
let mode = 'normal',
  loggedIn = true;
const math = Object.create(Math);
math.random = () => 0.7;
const item = (id, name = String(id)) => ({
  id,
  name,
  creator: { userId: 1 },
  updateTime: now - 1000,
});
const context = {
  module: { exports: {} },
  Date: Clock,
  Math: math,
  localStorage: {
    getItem: key => storage.get(key),
    setItem: (key, value) => storage.set(key, value),
  },
  isAccountLoggedIn: () => loggedIn,
  request: async options => {
    requests.push(options);
    if (mode === 'failure') throw new Error('offline');
    if (options.url === '/recommend/resource')
      return { code: 200, recommend: [item('P1'), item('P2'), item('P3')] };
    if (mode === 'short')
      return {
        code: 200,
        playlists: [item('one'), item('two')],
        total: 100000,
      };
    const prefix = options.url.includes('highquality') ? 'Q' : 'H';
    return {
      code: 200,
      playlists: Array.from({ length: 50 }, (_, i) => item(prefix + i)),
      total: 100000,
    };
  },
};
const source = fs
  .readFileSync('src/utils/playlistRecommendations.js', 'utf8')
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace(/export /g, '');
vm.runInNewContext(
  source +
    '\nmodule.exports={prioritizePlaylists,randomPlaylistPage,recommendationDay,fetchPlaylistRecommendations};',
  context
);
const {
  prioritizePlaylists,
  randomPlaylistPage,
  recommendationDay,
  fetchPlaylistRecommendations,
} = context.module.exports;
const publicSection = { key: 'discoverPlaylists', params: { limit: 10 } };
const personalSection = { key: 'recommend', params: { limit: 10 } };
const key = (scope, section) =>
  'playlist-recent:' + JSON.stringify([scope, section]);
(async () => {
  const ranked = prioritizePlaylists(
    [item(1), item(2), item(3)],
    [[{ id: '1' }], [{ id: '3' }]],
    10
  );
  assert.equal(
    ranked.items.map(item => item.id).join(','),
    '2,1,3',
    'New results first; older repeats fill the tail'
  );
  assert.equal(
    prioritizePlaylists([item(1, 'A-B'), item(2, 'AB')], [], 10).items.length,
    1,
    'Same author/name variants are duplicates'
  );
  const visited = new Set();
  const first = randomPlaylistPage(10000, visited, () => 0.7);
  visited.add(first);
  assert(first > 10);
  assert.notEqual(
    randomPlaylistPage(10000, visited, () => 0.7),
    first
  );
  assert.equal(randomPlaylistPage(20, new Set([0])), null);

  let previous = [];
  for (let round = 0; round < 5; round++) {
    const before = requests.length;
    const result = await fetchPlaylistRecommendations(publicSection, {
      scope: 'A',
    });
    assert.equal(result.length, 10);
    assert(
      result.every(row => !previous.includes(row.id)),
      'Prefer previously unseen candidates'
    );
    assert(requests.length - before <= 10);
    previous = result.map(row => row.id);
  }
  assert.equal(
    JSON.parse(storage.get(key('A', 'discoverPlaylists'))).length,
    4
  );
  assert(requests.some(request => request.url.includes('highquality')));
  assert(requests.some(request => request.url === '/top/playlist'));
  assert(
    requests
      .filter(request => request.url === '/top/playlist')
      .every(request => request.params.offset % 50 === 0)
  );
  assert(
    requests
      .filter(request => request.url.includes('highquality'))
      .every(request => request.params.offset === undefined)
  );

  mode = 'short';
  let before = requests.length;
  const small = await fetchPlaylistRecommendations(publicSection, {
    scope: 'short',
  });
  assert.equal(
    requests.length - before,
    10,
    'Hard cap of ten API pages even when fresh content is insufficient'
  );
  assert.equal(
    small.length,
    2,
    'Return available unique content, without fabricating more entries'
  );
  const offsets = requests
    .slice(before)
    .filter(request => request.url === '/top/playlist')
    .map(request => request.params.offset);
  assert.equal(
    new Set(offsets).size,
    offsets.length,
    'Random page indices do not repeat within a refresh'
  );
  mode = 'failure';
  before = requests.length;
  await assert.rejects(
    fetchPlaylistRecommendations(publicSection, { scope: 'offline' })
  );
  assert(
    requests.length - before <= 2,
    'Offline failure must not run ten slow retries'
  );
  assert(!storage.has(key('offline', 'discoverPlaylists')));

  mode = 'normal';
  before = requests.length;
  let result = await fetchPlaylistRecommendations(personalSection, {
    scope: 'personal',
  });
  assert(
    result.every(row => row.id.startsWith('P')),
    'Personal group never gets global fallback'
  );
  assert.equal(recommendationDay(), '2026-10-16');
  await fetchPlaylistRecommendations(personalSection, { scope: 'personal' });
  assert.equal(
    requests.length - before,
    1,
    'Same daily pool is reused even on repeated refreshes'
  );
  now += 2 * 60 * 1000;
  assert.equal(recommendationDay(), '2026-10-17');
  await Promise.all([
    fetchPlaylistRecommendations(personalSection, { scope: 'personal' }),
    fetchPlaylistRecommendations(personalSection, { scope: 'personal' }),
  ]);
  assert.equal(requests.length - before, 2, 'Daily rollover fetch is shared');
  loggedIn = false;
  before = requests.length;
  result = await fetchPlaylistRecommendations(personalSection, {
    scope: 'guest',
  });
  assert.equal(result.length, 0);
  assert.equal(
    requests.length,
    before,
    'Guest must not be shown global playlists as personal recommendations'
  );
  loggedIn = true;
  before = storage.size;
  await fetchPlaylistRecommendations(publicSection, {
    scope: 'late',
    isCurrent: () => false,
  });
  assert.equal(
    storage.size,
    before,
    'Stale account/category must not write history'
  );
  console.log(
    'Playlist recommendations: personal/global separation, daily rollover/shared requests, four histories, new-first fallback, random pages, ten-page cap and failure isolation passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
