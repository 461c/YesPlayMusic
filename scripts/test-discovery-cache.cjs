const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let now = 10000000;
class Clock extends Date {
  static now() {
    return now;
  }
}
const freshContext = { module: { exports: {} }, Date: Clock };
vm.runInNewContext(
  fs
    .readFileSync('src/utils/homeFreshness.js', 'utf8')
    .replace(/export /g, '') +
    '\nmodule.exports={homeContentFresh,HOME_CONTENT_TTL};',
  freshContext
);
const { homeContentFresh, HOME_CONTENT_TTL } = freshContext.module.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
const dailyRequests = [];
let loggedIn = true;
const dailyContext = {
  module: { exports: {} },
  Date: Clock,
  homeContentFresh,
  trackingScope: id => String(id),
  isAccountLoggedIn: () => loggedIn,
  dailyRecommendTracks: () =>
    new Promise((resolve, reject) => dailyRequests.push({ resolve, reject })),
};
vm.runInNewContext(
  fs
    .readFileSync('src/utils/dailyTracks.js', 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/export /g, '') + '\nmodule.exports={ensureDailyTracks};',
  dailyContext
);
const { ensureDailyTracks } = dailyContext.module.exports;
const store = {
  state: {
    data: { user: { userId: 1 }, loginMode: 'account' },
    dailyTracks: [],
  },
  commit(name, tracks) {
    assert.equal(name, 'updateDailyTracks');
    this.state.dailyTracks = tracks;
  },
};
const requests = [];
const request = (kind, params) =>
  new Promise((resolve, reject) =>
    requests.push({ kind, params, resolve, reject })
  );
const exploreContext = {
  module: { exports: {} },
  Date: Clock,
  homeContentFresh,
  mapState: () => ({}),
  mapMutations: () => ({}),
  trackingScope: id => String(id),
  NProgress: { start() {}, done() {} },
  setTimeout: () => {},
  topPlaylist: params => request('top', params),
  highQualityPlaylist: params => request('quality', params),
  toplists: params => request('charts', params),
  getRecommendPlayList: () => request('recommend'),
  ButtonTwoTone: {},
  CoverRow: {},
  SvgIcon: {},
  ExploreSearch: {},
  DailyTracksCard: {},
  FMCard: {},
};
vm.runInNewContext(
  fs
    .readFileSync('src/views/explore.vue', 'utf8')
    .split('<script>')[1]
    .split('</script>')[0]
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace('export default', 'module.exports ='),
  exploreContext
);
const component = exploreContext.module.exports;
function explore(category) {
  const page = {
    ...component.data.call({ $route: { query: { category } } }),
    active: true,
    $route: { query: { category } },
    $store: { state: { data: { user: { userId: 1 } } } },
  };
  for (const [key, method] of Object.entries(component.methods))
    page[key] = method.bind(page);
  for (const [key, get] of Object.entries(component.computed))
    Object.defineProperty(page, key, { get: get.bind(page) });
  return page;
}
(async () => {
  let work = ensureDailyTracks(store);
  const duplicate = ensureDailyTracks(store);
  assert.equal(
    dailyRequests.length,
    1,
    'Card and page share one daily request'
  );
  dailyRequests.at(-1).resolve({ data: { dailySongs: [{ id: 1 }] } });
  await Promise.all([work, duplicate]);
  now += HOME_CONTENT_TTL - 1;
  await ensureDailyTracks(store);
  assert.equal(dailyRequests.length, 1);
  now++;
  work = ensureDailyTracks(store);
  assert.equal(dailyRequests.length, 2);
  dailyRequests.at(-1).reject(new Error('offline'));
  await assert.rejects(work);
  assert.equal(
    store.state.dailyTracks[0].id,
    1,
    'Failure retains daily content without renewing TTL'
  );
  work = ensureDailyTracks(store);
  dailyRequests.at(-1).resolve({ data: { dailySongs: [{ id: 2 }] } });
  await work;
  work = ensureDailyTracks(store, true);
  dailyRequests.at(-1).resolve({ data: { dailySongs: [{ id: 3 }] } });
  await work;
  assert.equal(
    store.state.dailyTracks[0].id,
    3,
    'Manual refresh bypasses fresh daily TTL'
  );
  now += HOME_CONTENT_TTL;
  const old = ensureDailyTracks(store);
  store.state.data.user.userId = 2;
  const current = ensureDailyTracks(store);
  dailyRequests.at(-2).resolve({ data: { dailySongs: [{ id: 'old' }] } });
  dailyRequests.at(-1).resolve({ data: { dailySongs: [{ id: 'current' }] } });
  await Promise.all([old, current]);
  assert.equal(store.state.dailyTracks[0].id, 'current');
  loggedIn = false;
  await ensureDailyTracks(store);
  assert.equal(
    store.state.dailyTracks.length,
    0,
    'Logout clears account-bound daily tracks'
  );

  const page = explore('全部');
  work = page.loadData();
  const shared = page.loadData();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].params.offset, 0);
  requests[0].resolve({ playlists: [{ id: 1 }], more: true });
  await Promise.all([work, shared]);
  now += HOME_CONTENT_TTL - 1;
  await page.loadData();
  assert.equal(requests.length, 1);
  const firstAge = page.updatedAt;
  work = page.getPlaylist();
  assert.equal(requests.at(-1).params.offset, 1);
  requests.at(-1).resolve({ playlists: [{ id: 1 }, { id: 2 }], more: true });
  await work;
  assert.equal(page.playlists.length, 2, 'Pagination deduplicates songs');
  assert.equal(
    page.offset,
    3,
    'Next offset advances by raw server rows despite deduplication'
  );
  assert.equal(
    page.updatedAt,
    firstAge,
    'Pagination must not extend first-page freshness'
  );
  now++;
  work = page.loadData();
  assert.equal(
    requests.at(-1).params.offset,
    0,
    'Expired entry starts from the first page'
  );
  requests.at(-1).reject(new Error('offline'));
  await work;
  assert.equal(
    page.playlists.length,
    2,
    'Failed refresh preserves old discovery'
  );
  work = page.loadData();
  requests.at(-1).resolve({ playlists: [{ id: 3 }], more: true });
  await work;
  assert.equal(
    page.playlists.map(item => item.id).join(','),
    '3',
    'Refresh replaces rather than appends old entries'
  );
  const stale = page.loadData(true);
  page.$store.state.data.user.userId = 2;
  component.watch.accountScope.call(page);
  requests.at(-2).resolve({ playlists: [{ id: 'wrong-account' }] });
  requests.at(-1).resolve({ playlists: [{ id: 'right-account' }] });
  await stale;
  await tick();
  assert.equal(page.playlists[0].id, 'right-account');
  page.$route.query.category = '精品歌单';
  work = page.loadData();
  assert.equal(requests.at(-1).params.before, 0);
  requests
    .at(-1)
    .resolve({ playlists: [{ id: 10, updateTime: 99 }], more: true });
  await work;
  work = page.getPlaylist();
  assert.equal(requests.at(-1).params.before, 99);
  requests
    .at(-1)
    .resolve({ playlists: [{ id: 11, updateTime: 98 }], more: false });
  await work;
  console.log(
    'Discovery: daily TTL/shared requests/force/logout/account races; Explore TTL, pagination, stale fallback and category cursors passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
