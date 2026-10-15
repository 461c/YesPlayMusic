import Dexie from 'dexie';

const manifests = new Dexie('yesplaymusic-library-artwork');
manifests.version(1).stores({ playlists: '&key' });
let generation = 0;
let account = '';
let library = new Set();
let memberships = new Map();
let libraryTracks = new Set();
const earlyPlaylists = new Map();
const earlyTracks = new Map();
let catalogReady = false;
let syncing = false;
// The known library is available before the first concurrent startup responses arrive.
try {
  const data = JSON.parse(localStorage.getItem('data') || '{}');
  account = String(data.user?.userId || '');
  const saved = JSON.parse(localStorage.getItem('artwork-library') || '{}');
  if (saved.account === account) library = new Set(saved.ids || []);
  if (data.likedSongPlaylistID) library.add(String(data.likedSongPlaylistID));
} catch (_) {
  /* Storage can be disabled; the next ordinary library response initializes it. */
}

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
  syncing = false;
  generation++;
}

// Only the playlist covers are prefetched. No playlist/song API requests originate here.
export async function syncLibraryArtwork(playlists, user, isCurrent) {
  if (!native()?.cacheLibraryArtwork || !user || !isCurrent()) return;
  const epoch = ++generation;
  syncing = true;
  if (account !== user) {
    if (account) {
      earlyPlaylists.clear();
      earlyTracks.clear();
    }
    memberships = new Map();
    native().resetArtworkEligibility?.();
  }
  account = user;
  catalogReady = true;
  library = new Set(playlists.map(playlist => String(playlist.id)));
  try {
    localStorage.setItem(
      'artwork-library',
      JSON.stringify({ account, ids: [...library] })
    );
  } catch (_) {
    /* Persistence is optional. */
  }
  for (const id of memberships.keys())
    if (!library.has(id)) memberships.delete(id);
  rebuildTracks();
  for (const [id, playlist] of earlyPlaylists) {
    if (library.has(id)) observePlaylistArtwork(playlist);
  }
  earlyPlaylists.clear();
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
  observeTrackArtwork([...earlyTracks.values()]);
  earlyTracks.clear();
  syncing = false;
}

// Enroll only data already returned by ordinary library navigation requests.
export function observePlaylistArtwork(playlist) {
  const id = String(playlist.id);
  if (!native()?.allowLibraryArtwork) return;
  if (!library.has(id)) {
    if (!catalogReady || syncing) earlyPlaylists.set(id, playlist);
    return;
  }
  const ids = (playlist.trackIds || playlist.tracks || []).map(track =>
    String(track.id)
  );
  memberships.set(id, ids);
  rebuildTracks();
  manifests.playlists.put({ key: `${account}:${id}`, ids }).catch(() => {});
  observeTrackArtwork(playlist.tracks || []);
}
export function observeTrackArtwork(tracks) {
  if (!native()?.allowLibraryArtwork) return;
  for (const track of tracks) {
    if ((!catalogReady || syncing) && !libraryTracks.has(String(track.id)))
      earlyTracks.set(String(track.id), {
        id: track.id,
        al: { picUrl: track.al?.picUrl || track.album?.picUrl },
      });
  }
  // Eligibility does not download: native storage is filled only when an image is requested.
  send(
    'allowLibraryArtwork',
    tracks
      .filter(track => libraryTracks.has(String(track.id)))
      .map(track => track.al?.picUrl || track.album?.picUrl)
  );
}
