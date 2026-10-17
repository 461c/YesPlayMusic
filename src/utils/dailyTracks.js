import { dailyRecommendTracks } from '@/api/playlist';
import { isAccountLoggedIn } from '@/utils/auth';
import { trackingScope } from './trackingStore';
import { homeContentFresh } from './homeFreshness';

// Shared by the home card and song page; no persistent image/audio cache is cleared.
const entries = new WeakMap();
const scopeOf = store =>
  JSON.stringify([
    trackingScope(store.state.data?.user?.userId),
    store.state.data?.loginMode,
  ]);
export function ensureDailyTracks(store, force = false) {
  if (!isAccountLoggedIn()) {
    entries.delete(store);
    if (store.state.dailyTracks.length) store.commit('updateDailyTracks', []);
    return Promise.resolve([]);
  }
  const scope = scopeOf(store);
  let entry = entries.get(store);
  if (!entry || entry.scope !== scope) {
    entry = { scope, updatedAt: 0, pending: null };
    entries.set(store, entry);
    store.commit('updateDailyTracks', []);
  }
  if (entry.pending) return entry.pending;
  if (!force && homeContentFresh(entry.updatedAt))
    return Promise.resolve(store.state.dailyTracks);
  const current = () =>
    entries.get(store) === entry &&
    scopeOf(store) === scope &&
    isAccountLoggedIn();
  const work = dailyRecommendTracks()
    .then(result => {
      const tracks = result?.data?.dailySongs;
      if (!Array.isArray(tracks)) throw new Error('每日推荐暂时无法加载');
      if (!current()) return [];
      store.commit('updateDailyTracks', tracks);
      entry.updatedAt = Date.now();
      return tracks;
    })
    .finally(() => {
      if (entry.pending === work) entry.pending = null;
    });
  entry.pending = work;
  return work;
}
