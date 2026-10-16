const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs
  .readFileSync('src/views/tracking.vue', 'utf8')
  .split('<script>')[1]
  .split('</script>')[0]
  .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
  .replace('export default', 'module.exports =');
const requests = [];
const writes = [];
let saved = null;
const sandbox = {
  module: { exports: {} },
  Date,
  Promise,
  JSON,
  Set,
  String,
  trackingSections: [],
  trackingScope: id => String(id),
  normalizeTrackingId: value => (/^[1-9]\d*$/.test(value) ? value : null),
  readTrackingList: async () => [],
  saveTrackingList: async (scope, users) => writes.push({ scope, users }),
  readTrackingSnapshot: async () => saved,
  saveTrackingSnapshot: async (...args) => writes.push(args),
  deleteTrackingSnapshots: async () => {},
  readTrackingSection: (uid, section, cursor) =>
    new Promise((resolve, reject) =>
      requests.push({ uid, section, cursor, resolve, reject })
    ),
};
vm.runInNewContext(source, sandbox);
const component = sandbox.module.exports;
function instance() {
  const instance = {
    ...component.data(),
    scope: 'account-A',
    $store: { state: { player: {} } },
  };
  Object.entries(component.methods).forEach(
    ([key, method]) => (instance[key] = method.bind(instance))
  );
  Object.entries(component.computed)
    .filter(([key]) => key !== 'scope')
    .forEach(([key, get]) =>
      Object.defineProperty(instance, key, { get: get.bind(instance) })
    );
  return instance;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const page = instance();
  page.ready = true;
  page.addUser('123');
  await tick();
  assert.equal(
    requests.length,
    1,
    'Adding a user must only fetch selected profile'
  );
  page.addUser('456');
  await tick();
  requests[0].resolve({ profile: { nickname: 'Old user' } });
  requests[1].resolve({ profile: { nickname: 'Current user' } });
  await tick();
  assert.equal(
    page.profile.nickname,
    'Current user',
    'Stale response must not replace selected user'
  );
  assert.equal(
    page.users[0].name,
    '',
    'Stale response must not modify another profile'
  );
  page.move(1, -1);
  assert.equal(page.users[0].id, '456');
  page.addUser('456');
  assert.equal(page.users.length, 2, 'Duplicates are not added');
  page.addUser('not-an-id');
  assert.equal(page.users.length, 2);
  saved = { data: { weekData: [{ song: { id: 1 } }] }, updatedAt: 42 };
  const count = requests.length;
  page.changeTab('week');
  await tick();
  assert.equal(
    requests.length,
    count,
    'Cached section must not make an implicit request'
  );
  assert.equal(page.updatedAt, 42);
  assert.equal(page.items.length, 1);
  const refresh = page.load(true);
  await tick();
  requests.at(-1).reject(new Error('private'));
  await refresh;
  assert.equal(page.items.length, 1, 'Failed refresh keeps offline snapshot');
  assert.equal(page.error, 'private');
  saved = null;
  page.changeTab('playlists');
  await tick();
  requests.at(-1).resolve({ playlist: [{ id: 1 }], more: true });
  await tick();
  const more = page.load(false, true);
  await tick();
  assert.equal(requests.at(-1).cursor.offset, 1);
  requests.at(-1).resolve({ playlist: [{ id: 1 }, { id: 2 }], more: false });
  await more;
  assert.equal(
    page.items.length,
    2,
    'Pagination de-duplicates overlapping rows'
  );
  page.changeTab('events');
  await tick();
  const late = requests.at(-1);
  page.remove('456');
  await tick();
  late.resolve({ events: [{ id: 'deleted-user' }] });
  await tick();
  assert.equal(page.selected, '123');
  assert.equal(page.payload, null, 'Deleted user request must not reappear');
  await page.listWrites;
  assert.equal(writes.filter(row => row.scope).at(-1).users.length, 1);
  console.log(
    'Tracking: selected-only requests, response races, saved content, refresh failure, order, removal and pagination passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
