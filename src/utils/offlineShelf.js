import { readSavedPlaylists } from './offlineLibrary';
import { getSavedAlbums, playableLibraryIds } from './db';
import { cacheTargets } from './libraryCache';

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
