import { artworkBridge } from './desktopArtwork';
import { trackingScope } from './trackingStore';

// Eligibility only: persist an image after its ordinary <img> request, never prefetch.
const storageKey = 'tracking-artwork';
function catalog(scope) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    if (saved.scope === scope && saved.users && saved.tracks) return saved;
  } catch (_) {
    /* Optional storage. */
  }
  return { scope, users: {}, tracks: {} };
}
function save(value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (_) {
    /* Optional storage. */
  }
}
function currentCatalog() {
  try {
    const data = JSON.parse(localStorage.getItem('data') || '{}');
    return catalog(trackingScope(data.user?.userId));
  } catch (_) {
    return null;
  }
}
const imageKeys = new Set([
  'picUrl',
  'img1v1Url',
  'avatarUrl',
  'coverImgUrl',
  'originUrl',
  'squareUrl',
  'backgroundUrl',
  'backgroundImageUrl',
  'backgroundImgUrl',
  'rectangleUrl',
  'originalUrl',
]);
function allow(data) {
  const native = artworkBridge();
  if (!native?.allowLibraryArtwork) return;
  const urls = new Set();
  const collect = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (imageKeys.has(key) && typeof child === 'string') urls.add(child);
      else if (key === 'backgroundCandidates' && Array.isArray(child))
        child.forEach(url => {
          if (typeof url === 'string') urls.add(url);
        });
      else if (key === 'json' && typeof child === 'string') {
        try {
          collect(JSON.parse(child));
        } catch (_) {
          /* Malformed event data. */
        }
      } else if (typeof child === 'object') collect(child);
    }
  };
  collect(data);
  const list = [...urls];
  for (let i = 0; i < list.length; i += 200)
    native.allowLibraryArtwork(JSON.stringify(list.slice(i, i + 200)));
}
function playlistIds(value) {
  return new Set(Object.values(value.users).flat());
}
export function observeTrackingArtwork(scope, uid, section, data) {
  const value = catalog(scope);
  if (section === 'playlists' && Array.isArray(data.playlist)) {
    value.users[uid] = data.playlist.map(item => String(item.id));
    save(value);
  }
  if (section === 'likes' && data.playlist)
    rememberTracks(value, data.playlist);
  allow(data);
}
function rememberTracks(value, playlist) {
  if (!playlist.id) return;
  value.tracks[String(playlist.id)] = (
    playlist.trackIds ||
    playlist.tracks ||
    []
  ).map(item => String(item.id));
  save(value);
}
export function observeTrackedPlaylistArtwork(playlist) {
  if (!playlist) return;
  const value = currentCatalog();
  if (!value || !playlistIds(value).has(String(playlist.id))) return;
  rememberTracks(value, playlist);
  allow(playlist);
}
export function observeTrackedTrackArtwork(tracks) {
  const value = currentCatalog();
  if (!value) return;
  const ids = playlistIds(value);
  const known = new Set(
    Object.entries(value.tracks)
      .filter(([id]) => ids.has(id))
      .flatMap(([, tracks]) => tracks)
  );
  allow(tracks.filter(track => known.has(String(track.id))));
}
export function removeTrackingArtwork(scope, uid) {
  const value = catalog(scope);
  delete value.users[uid];
  const ids = playlistIds(value);
  for (const id of Object.keys(value.tracks))
    if (!ids.has(id)) delete value.tracks[id];
  save(value);
}
