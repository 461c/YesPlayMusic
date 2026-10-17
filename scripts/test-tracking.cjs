const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const requests = [],
  writes = [];
let saved = null;
let snapshotReads = 0;
const artwork = [];
const playableContext = {
  module: { exports: {} },
  isAccountLoggedIn: () => false,
  store: { state: { data: { user: {} } } },
};
const common = fs.readFileSync('src/utils/common.js', 'utf8');
vm.runInNewContext(
  common
    .slice(
      common.indexOf('export function isTrackPlayable'),
      common.indexOf('export function randomNum')
    )
    .replace(/export /g, '') + '\nmodule.exports = { mapTrackPlayableStatus };',
  playableContext
);
const eventContext = { module: { exports: {} } };
vm.runInNewContext(
  fs
    .readFileSync('src/utils/trackingEvents.js', 'utf8')
    .replace(/export /g, '') +
    '\nmodule.exports={eventData,mergeTrackingEvents};',
  eventContext
);
const sandbox = {
  ...eventContext.module.exports,
  archiveMode: () => false,
  archiveError: () => new Error('archive'),
  cacheTrackDetail() {},
  openPhotos() {},
  closePhotos() {},
  LibrarySearch: {},
  Date,
  Promise,
  JSON,
  Set,
  String,
  trackingScope: id => String(id),
  normalizeTrackingId: value =>
    /^[1-9]\d*$/.test(String(value)) ? String(value) : null,
  readTrackingList: async () => [],
  saveTrackingList: async (scope, users) => writes.push({ scope, users }),
  readTrackingSnapshot: async () => {
    snapshotReads++;
    return saved;
  },
  observeTrackingArtwork: (...args) => artwork.push(args),
  removeTrackingArtwork() {},
  mapTrackPlayableStatus: playableContext.module.exports.mapTrackPlayableStatus,
  saveTrackingSnapshot: async (...args) => writes.push(args),
  deleteTrackingSnapshots: async () => {},
  readTrackingSection: (uid, section, cursor) =>
    new Promise((resolve, reject) =>
      requests.push({ uid, section, cursor, resolve, reject })
    ),
  mapState: () => ({}),
  mapActions: () => ({}),
  mapMutations: () => ({}),
  SvgIcon: {},
  MvRow: {},
  ContextMenu: {},
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
    cacheEnabled: true,
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
function verifyArtworkCache() {
  const storage = new Map([['data', JSON.stringify({ user: { userId: 1 } })]]);
  const enrolled = [];
  const context = {
    module: { exports: {} },
    localStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
    },
    trackingScope: id => `account-${id}`,
    window: {
      YesPlayMusicAndroid: {
        allowLibraryArtwork: value => enrolled.push(...JSON.parse(value)),
      },
    },
  };
  const source = fs
    .readFileSync('src/utils/trackingArtwork.js', 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/export /g, '');
  vm.runInNewContext(
    source +
      '\nmodule.exports={observeTrackingArtwork,observeTrackedPlaylistArtwork,observeTrackedTrackArtwork,removeTrackingArtwork};',
    context
  );
  const cache = context.module.exports;
  cache.observeTrackingArtwork('account-1', '10', 'playlists', {
    playlist: [{ id: 20, coverImgUrl: 'cover' }],
  });
  assert.equal(enrolled.join(','), 'cover');
  cache.observeTrackedPlaylistArtwork({
    id: 21,
    tracks: [{ id: 211, al: { picUrl: 'unknown' } }],
  });
  assert.equal(
    enrolled.length,
    1,
    'Untracked playlists must not enroll artwork'
  );
  cache.observeTrackedPlaylistArtwork({
    id: 20,
    tracks: [{ id: 201, al: { picUrl: 'known' } }],
  });
  cache.observeTrackedTrackArtwork([
    { id: 201, al: { picUrl: 'known-detail' } },
    { id: 999, al: { picUrl: 'random' } },
  ]);
  assert.equal(enrolled.join(','), 'cover,known,known-detail');
  cache.removeTrackingArtwork('account-1', '10');
  cache.observeTrackedPlaylistArtwork({ id: 20, coverImgUrl: 'removed' });
  assert.equal(
    enrolled.length,
    3,
    'Removing a saved user stops future enrollment'
  );
  cache.observeTrackingArtwork('account-1', '10', 'playlists', {
    playlist: [{ id: 20, coverImgUrl: 'cover' }],
  });
  storage.set('data', JSON.stringify({ user: { userId: 2 } }));
  cache.observeTrackedPlaylistArtwork({ id: 20, coverImgUrl: 'other-account' });
  assert.equal(
    enrolled.length,
    4,
    'Artwork membership must be account/API scoped'
  );
}
verifyArtworkCache();
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const library = component('src/views/library.vue');
  const libraryState = {
    data: { user: { userId: 123 } },
    liked: {
      playlists: [
        { id: 1, creator: { userId: 123 }, specialType: 5 },
        { id: 2, creator: { userId: '123' } },
        { id: 3, creator: { userId: 456 } },
      ],
    },
    currentTab: 'created',
  };
  assert.equal(
    library.computed.filterPlaylists
      .call(libraryState)
      .map(item => item.id)
      .join(','),
    '2'
  );
  libraryState.currentTab = 'saved';
  assert.equal(
    library.computed.filterPlaylists
      .call(libraryState)
      .map(item => item.id)
      .join(','),
    '3'
  );
  const parent = instance(component('src/views/tracking.vue'));
  parent.ready = true;
  parent.managing = true;
  parent.inputId = '123';
  parent.addUser();
  parent.inputId = '456';
  parent.addUser();
  assert.equal(
    parent.groups.map(item => item.key).join(','),
    'activity,listening,follows,fans,created,saved'
  );
  const playlists = [
    { id: 1, specialType: 5, creator: { userId: 456 } },
    { id: 2, creator: { userId: 456 } },
    { id: 3, creator: { userId: 999 } },
  ];
  assert.equal(requests.length, 0, 'Management must not fetch user content');
  parent.move(1, -1);
  parent.selectUser('456');
  assert.equal(parent.likedPlaylist(playlists).id, 1);
  parent.group = 'created';
  assert.equal(
    parent
      .groupPlaylists(playlists)
      .map(item => item.id)
      .join(','),
    '2'
  );
  parent.group = 'saved';
  assert.equal(
    parent
      .groupPlaylists(playlists)
      .map(item => item.id)
      .join(','),
    '3'
  );
  assert.equal(parent.users[0].id, '456');
  parent.group = 'follows';
  const savedUsers = parent.users.length;
  parent.openUser({ userId: 999, nickname: 'Temporary' });
  assert.equal(parent.selected, '999');
  assert.equal(parent.isSavedUser, false);
  assert.equal(parent.selectedUser.name, 'Temporary');
  assert.equal(
    parent.users.length,
    savedUsers,
    'Opening a user must never enroll them'
  );
  parent.backUser();
  assert.equal(parent.selected, '456');
  assert.equal(parent.group, 'follows');
  assert.equal(parent.isSavedUser, true);
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
  page.section = 'likes';
  page.playlistId = 1;
  const likes = page.load();
  await tick();
  assert.equal(requests.at(-1).cursor.id, 1);
  requests.at(-1).resolve({
    playlist: {
      id: 1,
      tracks: Array.from({ length: 20 }, (_, i) => ({
        id: 42 + i,
        name: 'liked song',
        fee: 0,
      })),
    },
  });
  await likes;
  assert.equal(page.tracks[0].id, 42);
  assert.equal(page.tracks.length, 12, 'Three columns must have four rows');
  assert.equal(
    page.tracks[0].playable,
    true,
    'Missing playback flags are normalized'
  );
  page.payload.privileges = [{ id: 42, st: -1 }];
  page.payload.playlist.tracks[0].noCopyrightRcmd = {};
  assert.equal(
    page.tracks[0].playable,
    false,
    'Real availability restrictions remain'
  );
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
  page.section = 'follows';
  const follows = page.load();
  await tick();
  requests.at(-1).resolve({ follow: [{ userId: 7 }], more: true });
  await follows;
  const nextFollows = page.load(false, true);
  await tick();
  assert.equal(requests.at(-1).cursor.offset, 1);
  requests
    .at(-1)
    .resolve({ follow: [{ userId: 7 }, { userId: 8 }], more: false });
  await nextFollows;
  assert.equal(page.items.length, 2);
  page.payload.follow = [{ userId: 7 }, { userId: 8, artistId: 80 }];
  assert.equal(
    page.items.length,
    2,
    'Followed artists and users must all remain visible'
  );
  page.section = 'fans';
  const fans = page.load();
  await tick();
  requests.at(-1).resolve({ followeds: [{ userId: 12 }], more: true });
  await fans;
  const nextFans = page.load(false, true);
  await tick();
  assert.equal(requests.at(-1).cursor.offset, 1);
  requests
    .at(-1)
    .resolve({ followeds: [{ userId: 12 }, { userId: 13 }], more: false });
  await nextFans;
  assert.equal(page.items.length, 2);
  const temp = instance(sectionComponent, {
    uid: '999',
    section: 'profile',
    cacheEnabled: false,
  });
  saved = { data: { profile: { nickname: 'Must not read' } }, updatedAt: 1 };
  const beforeTemporary = {
    reads: snapshotReads,
    writes: writes.length,
    artwork: artwork.length,
  };
  const temporaryRequest = temp.load();
  await tick();
  requests.at(-1).resolve({ profile: { nickname: 'Temporary profile' } });
  await temporaryRequest;
  assert.equal(temp.profile.nickname, 'Temporary profile');
  assert.equal(
    snapshotReads,
    beforeTemporary.reads,
    'Temporary browsing must not read persistent snapshots'
  );
  assert.equal(
    writes.length,
    beforeTemporary.writes,
    'Temporary browsing must not write persistent snapshots'
  );
  assert.equal(
    artwork.length,
    beforeTemporary.artwork,
    'Temporary browsing must not enroll artwork'
  );
  saved = null;
  let refreshCalls = 0;
  parent.$refs = {
    collection: { load: async () => refreshCalls++ },
    people: { load: async () => refreshCalls++ },
  };
  await parent.refreshCurrent();
  assert.equal(refreshCalls, 2, 'Refresh only mounted sections');
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
    'Tracking: management editing/order/removal, library groups and playlist ownership, temporary browsing isolation, artwork membership, playable preview, request races, offline reads, refresh failure and pagination passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
