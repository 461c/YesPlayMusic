const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const moduleContext = { module: { exports: {} }, Set, encodeURIComponent };
vm.runInNewContext(
  fs.readFileSync('src/utils/homeSections.js', 'utf8').replace(/export /g, '') +
    '\nmodule.exports={homeSectionCatalog,normalizeHomeSections,homeSections};',
  moduleContext
);
const { homeSectionCatalog, normalizeHomeSections, homeSections } =
  moduleContext.module.exports;
assert(homeSectionCatalog.length >= 20);
assert.equal(
  homeSectionCatalog.find(item => item.key === 'forYou').title,
  'For You'
);
assert.equal(
  normalizeHomeSections([
    'recommendedMV',
    'latestMV',
    'relax',
    'workout',
    'charts',
  ]).join(','),
  'charts'
);
assert.equal(
  normalizeHomeSections([]).length,
  0,
  'Empty selection must not restore defaults'
);
assert.equal(
  normalizeHomeSections(['charts', 'unknown', 'charts', 'albums']).join(','),
  'charts,albums'
);
assert(
  !normalizeHomeSections(null, false).includes('apple'),
  'Preserve the previous Apple Music preference during migration'
);
let now = 10000000;
class Clock extends Date {
  static now() {
    return now;
  }
}
const fresh = { module: { exports: {} }, Date: Clock };
vm.runInNewContext(
  fs
    .readFileSync('src/utils/homeFreshness.js', 'utf8')
    .replace(/export /g, '') +
    '\nmodule.exports={homeContentFresh, HOME_CONTENT_TTL};',
  fresh
);
const { homeContentFresh, HOME_CONTENT_TTL } = fresh.module.exports;
const requests = [];
const source = fs
  .readFileSync('src/views/home.vue', 'utf8')
  .split('<script>')[1]
  .split('</script>')[0]
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace('export default', 'module.exports =');
const context = {
  module: { exports: {} },
  homeSections,
  homeContentFresh,
  ensureDailyTracks: async () => [],
  Date: Clock,
  trackingScope: () => 'account-A',
  CoverRow: {},
  TrackList: {},
  MvRow: {},
  FMCard: {},
  DailyTracksCard: {},
  Set,
  Promise,
  fetchHomeSection: section =>
    new Promise((resolve, reject) =>
      requests.push({ key: section.key, resolve, reject })
    ),
};
vm.runInNewContext(source, context);
const component = context.module.exports;
function instance(keys) {
  const p = {
    ...component.data(),
    $store: {
      state: {
        settings: { homeSections: keys },
        data: { user: { userId: 1 } },
      },
    },
    $set(object, key, value) {
      object[key] = value;
    },
    $delete(object, key) {
      delete object[key];
    },
  };
  for (const [key, method] of Object.entries(component.methods))
    p[key] = method.bind(p);
  for (const [key, get] of Object.entries(component.computed))
    Object.defineProperty(p, key, { get: get.bind(p) });
  p.active = true;
  return p;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const page = instance(['charts', 'albums', 'hot', 'light']);
  const work = page.loadData();
  await tick();
  assert.equal(requests.length, 3, 'Limit initial concurrency');
  const duplicate = page.loadData();
  await tick();
  assert.equal(requests.length, 3, 'Reactivation must share in-flight workers');
  page.$store.state.settings.homeSections = ['charts', 'albums', 'hot'];
  requests.slice(0, 3).forEach(request => request.resolve([]));
  await Promise.all([work, duplicate]);
  assert.equal(
    requests.length,
    3,
    'Do not request rows disabled before their turn'
  );
  await page.loadData();
  assert.equal(requests.length, 3, 'Cached rows do not re-fetch');
  const other = instance(['charts']);
  const pending = other.loadData();
  await tick();
  component.watch.accountScope.call(other);
  await tick();
  const old = requests[3],
    current = requests[4];
  old.resolve([{ id: 'wrong-account' }]);
  current.resolve([{ id: 'current-account' }]);
  await pending;
  await tick();
  assert.equal(
    other.rows.charts[0].id,
    'current-account',
    'Account changes must invalidate earlier responses'
  );
  const ttlPage = instance(['charts']);
  let refresh = ttlPage.loadData();
  await tick();
  requests.at(-1).resolve([{ id: 'cached' }]);
  await refresh;
  const cachedCount = requests.length;
  now += HOME_CONTENT_TTL - 1;
  await ttlPage.loadData();
  assert.equal(
    requests.length,
    cachedCount,
    'Reuse content for less than 30 minutes'
  );
  now++;
  refresh = ttlPage.loadData();
  await tick();
  assert.equal(
    requests.length,
    cachedCount + 1,
    'Exactly 30 minutes expires the row'
  );
  assert.equal(
    ttlPage.rows.charts[0].id,
    'cached',
    'Keep old content visible while refreshing'
  );
  requests.at(-1).reject(new Error('offline'));
  await refresh;
  assert.equal(ttlPage.rows.charts[0].id, 'cached');
  ttlPage.errors = {};
  refresh = ttlPage.loadData();
  await tick();
  requests.at(-1).resolve([{ id: 'fresh' }]);
  await refresh;
  assert.equal(ttlPage.rows.charts[0].id, 'fresh');
  const forced = ttlPage.refreshHome();
  const coalesced = ttlPage.refreshHome();
  await tick();
  const forcedCount = requests.length;
  requests.at(-1).resolve([{ id: 'manual' }]);
  await Promise.all([forced, coalesced]);
  assert.equal(
    requests.length,
    forcedCount,
    'Manual refresh coalesces overlapping calls'
  );
  assert.equal(ttlPage.rows.charts[0].id, 'manual');
  console.log(
    'Home sections: catalog, migration, empty selection, order, bounded requests, disabled rows, 30-minute expiry, stale fallback, manual refresh and account races passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
