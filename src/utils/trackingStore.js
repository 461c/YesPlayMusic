import Dexie from 'dexie';

const db = new Dexie('yesplaymusic-tracking');
db.version(1).stores({ lists: '&scope', snapshots: '&key,scope,uid' });

export function trackingScope(userId) {
  const api =
    window.YesPlayMusicAndroid?.getApiUrl?.() ||
    process.env.VUE_APP_NETEASE_API_URL ||
    'netease';
  return JSON.stringify([String(userId || 'guest'), api]);
}
export function normalizeTrackingId(value) {
  const id = String(value || '').trim();
  return /^[1-9]\d{0,17}$/.test(id) ? id : null;
}
export const readTrackingList = scope =>
  db.lists
    .get(scope)
    .then(row => row?.users || [])
    .catch(() => []);
export const saveTrackingList = (scope, users) =>
  db.lists.put({ scope, users: JSON.parse(JSON.stringify(users)) });
export const readTrackingSnapshot = (scope, uid, section) =>
  db.snapshots.get(JSON.stringify([scope, uid, section])).catch(() => null);
export function saveTrackingSnapshot(scope, uid, section, data) {
  return db.snapshots.put({
    key: JSON.stringify([scope, uid, section]),
    scope,
    uid,
    data: JSON.parse(JSON.stringify(data)),
    updatedAt: Date.now(),
  });
}
export function deleteTrackingSnapshots(scope, uid) {
  return db.snapshots
    .where('scope')
    .equals(scope)
    .filter(row => row.uid === uid)
    .delete();
}
