import Dexie from 'dexie';

const manifests = new Dexie('yesplaymusic-library-artwork');
manifests.version(1).stores({ playlists: '&key' });
let generation = 0;
let account = '';
let library = new Set();
let memberships = new Map();
let libraryTracks = new Set();

const native = () => window.YesPlayMusicAndroid;
function send(method, urls) {
  if (!native()?.[method]) return;
  const unique = [...new Set(urls.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += 200) {
    native()[method](JSON.stringify(unique.slice(offset, offset + 200)));
  }
}
function rebuildTracks() {
  libraryTracks = new Set([...memberships.values()].flat());
}
export function cancelArtworkSync() {
  generation++;
}

// Only the playlist covers are prefetched. No playlist/song API requests originate here.
export async function syncLibraryArtwork(playlists, user, isCurrent) {
  if (!native()?.cacheLibraryArtwork || !user || !isCurrent()) return;
  const epoch = ++generation;
  if (account !== user) {
    memberships = new Map();
    native().resetArtworkEligibility?.();
  }
  account = user;
  library = new Set(playlists.map(playlist => String(playlist.id)));
  for (const id of memberships.keys())
    if (!library.has(id)) memberships.delete(id);
  rebuildTracks();
  send(
    'cacheLibraryArtwork',
    playlists.map(playlist => playlist.coverImgUrl)
  );
  for (const id of library) {
    const previous = await manifests.playlists
      .get(`${user}:${id}`)
      .catch(() => null);
    if (epoch !== generation || !isCurrent()) return;
    if (!memberships.has(id) && previous?.ids)
      memberships.set(id, previous.ids);
  }
  rebuildTracks();
}

// Enroll only data already returned by ordinary library navigation requests.
export function observePlaylistArtwork(playlist) {
  const id = String(playlist.id);
  if (!native()?.allowLibraryArtwork || !library.has(id)) return;
  const ids = (playlist.trackIds || playlist.tracks || []).map(track =>
    String(track.id)
  );
  memberships.set(id, ids);
  rebuildTracks();
  manifests.playlists.put({ key: `${account}:${id}`, ids }).catch(() => {});
  observeTrackArtwork(playlist.tracks || []);
}
export function observeTrackArtwork(tracks) {
  // Eligibility does not download: native storage is filled only when an image is requested.
  send(
    'allowLibraryArtwork',
    tracks
      .filter(track => libraryTracks.has(String(track.id)))
      .map(track => track.al?.picUrl)
  );
}
