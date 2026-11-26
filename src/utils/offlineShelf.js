import { readSavedPlaylists } from './offlineLibrary';
import { getSavedAlbums, playableLibraryIds } from './db';
import { cacheTargets } from './libraryCache';
import { readTrackingList, readTrackingSnapshot } from './trackingStore';
import { eventData } from './trackingEvents';

export async function readShelf(state, scope) {
  const targets = cacheTargets(state);
  const [saved, albums, playable] = await Promise.all([
    readSavedPlaylists(scope),
    getSavedAlbums(state.liked.albums.map(a => a.id)),
    playableLibraryIds(),
  ]);
  const memberships = new Map();
  for (const { playlist } of saved) {
    if (playlist.trackIds)
      memberships.set('playlist:' + playlist.id, playlist.trackIds);
  }
  for (const album of albums) {
    if (album.songs) memberships.set('album:' + album.album.id, album.songs);
  }
  return targets.map(target => {
    const items =
      memberships.get(target.key) ||
      (target.group === 'likes' && state.liked.songs.length
        ? state.liked.songs
        : null);
    const ids = items?.map(t => Number(t.id ?? t)) || [];
    return {
      ...target,
      known: !!items,
      total: ids.length,
      ready: ids.filter(id => playable.has(String(id))),
    };
  });
}

export async function savedPeople(scope) {
  const users = await readTrackingList(scope);
  return Promise.all(
    users.map(async user => {
      const snapshot = await readTrackingSnapshot(
        scope,
        String(user.id),
        'events'
      );
      const event = snapshot?.data?.events?.[0];
      return {
        ...user,
        summary: event?.archiveStatus
          ? '已保存的动态 · 目前不可见'
          : event
          ? eventData(event)?.msg || event.message || '分享了一条动态'
          : '暂无已保存动态',
      };
    })
  );
}
