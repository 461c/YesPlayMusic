const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const requests = [],
  writes = [];
let saved = null;
const sandbox = {
  Date,
  Promise,
  JSON,
  Set,
  String,
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
  TrackingSection: {},
  CoverRow: {},
  TrackList: {},
};
function component(path) {
  const source = fs
    .readFileSync(path, 'utf8')
    .split('<script>')[1]
    .split('</script>')[0]
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace('export default', 'module.exports =');
  const context = { ...sandbox, module: { exports: {} } };
  vm.runInNewContext(source, context);
  return context.module.exports;
}
function instance(component, props = {}) {
  const instance = {
    ...component.data(),
    scope: 'account-A',
    $store: { state: { player: {} } },
    $emit() {},
    $set(array, index, value) {
      array.splice(index, 1, value);
    },
    ...props,
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
  const parent = instance(component('src/views/tracking.vue'));
  parent.ready = true;
  parent.managing = true;
  parent.inputId = '123';
  parent.addUser();
  parent.inputId = '456';
  parent.addUser();
  assert.equal(parent.groups.length, 3);
  assert.equal(requests.length, 0, 'Management must not fetch user content');
  parent.move(1, -1);
  assert.equal(parent.users[0].id, '456');
  parent.edit(parent.users[0]);
  parent.editAlias = '备注';
  parent.saveEdit('456');
  assert.equal(parent.users[0].alias, '备注');
  parent.edit(parent.users[0]);
  parent.editId = '123';
  parent.saveEdit('456');
  assert.equal(parent.users[0].id, '456', 'Duplicate ID edit must be rejected');
  parent.editId = '789';
  parent.saveEdit('456');
  assert.equal(parent.selected, '789');
  assert.equal(parent.users[0].alias, '备注');
  parent.inputId = '789';
  parent.addUser();
  assert.equal(parent.users.length, 2);
  parent.remove('789');
  assert.equal(parent.selected, '123');
  await parent.listWrites;
  const sectionComponent = component('src/components/TrackingSection.vue');
  const page = instance(sectionComponent, { uid: '123', section: 'profile' });
  const old = page.load();
  await tick();
  page.uid = '456';
  const current = page.load();
  await tick();
  requests[0].resolve({ profile: { nickname: 'Old user' } });
  requests[1].resolve({ profile: { nickname: 'Current user' } });
  await Promise.all([old, current]);
  assert.equal(
    page.profile.nickname,
    'Current user',
    'Late old-user response must not overwrite selected user'
  );
  saved = { data: { weekData: [{ song: { id: 1 } }] }, updatedAt: 42 };
  page.section = 'week';
  const count = requests.length;
  await page.load();
  assert.equal(
    requests.length,
    count,
    'Cached group re-entry must not request the server'
  );
  assert.equal(page.items.length, 1);
  const refresh = page.load(true);
  await tick();
  requests.at(-1).reject(new Error('private'));
  await refresh;
  assert.equal(page.items.length, 1);
  assert.equal(page.error, 'private');
  saved = null;
  page.section = 'playlists';
  const initial = page.load();
  await tick();
  requests.at(-1).resolve({ playlist: [{ id: 1 }], more: true });
  await initial;
  const more = page.load(false, true);
  await tick();
  assert.equal(requests.at(-1).cursor.offset, 1);
  requests.at(-1).resolve({ playlist: [{ id: 1 }, { id: 2 }], more: false });
  await more;
  assert.equal(page.items.length, 2);
  page.section = 'events';
  const pending = page.load();
  await tick();
  sectionComponent.beforeDestroy.call(page);
  requests.at(-1).resolve({ events: [{ id: 'late' }] });
  await pending;
  assert.equal(
    page.payload,
    null,
    'Destroyed group must ignore late responses'
  );
  console.log(
    'Tracking: management editing/order/removal, three groups, request races, offline reads, refresh failure and pagination passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
