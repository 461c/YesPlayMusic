import Dexie from 'dexie';

const cache = new Dexie('yesplaymusic-offline-library');
cache.version(1).stores({ library: '&key,scope', playlists: '&key,scope' });

export function emptyLibrary() {
  return {
    songs: [],
    songsWithDetails: [],
    playlists: [],
    albums: [],
    artists: [],
    mvs: [],
    cloudDisk: [],
    playHistory: { weekData: [], allData: [] },
  };
}
export function libraryScope(data) {
  try {
    const profile = data || JSON.parse(localStorage.getItem('data') || '{}');
    const id = profile.user?.userId;
    if (!id) return null;
    const api = window.YesPlayMusicAndroid?.getApiUrl?.() || 'netease';
    return JSON.stringify([String(id), api]);
  } catch (_) {
    return null;
  }
}
export async function readLibrary(scope) {
  if (!scope) return {};
  try {
    const rows = await cache.library.where('scope').equals(scope).toArray();
    return Object.fromEntries(
      rows
        .filter(row => row.name in emptyLibrary())
        .map(row => [row.name, row.value])
    );
  } catch (_) {
    return {};
  }
}
export function saveLibraryField(scope, name, value) {
  if (!scope || !(name in emptyLibrary())) return Promise.resolve();
  // Snapshot mutable Vue arrays before the asynchronous IndexedDB write.
  const copy = JSON.parse(JSON.stringify(value));
  return cache.library
    .put({ key: `${scope}:${name}`, scope, name, value: copy })
    .catch(error => console.debug('Unable to save library snapshot', error));
}
export async function getCachedPlaylist(id, scope = libraryScope()) {
  if (!scope || !id) return null;
  try {
    return (await cache.playlists.get(`${scope}:${id}`))?.value || null;
  } catch (_) {
    return null;
  }
}
export function savePlaylistSnapshot(id, value, scope = libraryScope()) {
  if (!scope || !id || !value?.playlist) return Promise.resolve();
  return cache.playlists
    .put({
      key: `${scope}:${id}`,
      scope,
      value: JSON.parse(JSON.stringify(value)),
    })
    .catch(error => console.debug('Unable to save playlist snapshot', error));
}

export async function readSavedPlaylists(scope) {
  if (!scope) return [];
  try {
    const rows = await cache.playlists.where('scope').equals(scope).toArray();
    return rows.map(row => row.value).filter(value => value?.playlist);
  } catch (_) {
    return [];
  }
}
