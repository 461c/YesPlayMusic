import Dexie from 'dexie';
import request from '@/utils/request';
import { getPlaylistDetail } from '@/api/playlist';

const manifests = new Dexie('yesplaymusic-library-artwork');
manifests.version(1).stores({ playlists: '&key' });
let generation = 0;

export function cancelArtworkSync() {
  generation++;
}

function enqueue(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  for (let offset = 0; offset < unique.length; offset += 200) {
    window.YesPlayMusicAndroid.cacheLibraryArtwork(
      JSON.stringify(unique.slice(offset, offset + 200))
    );
  }
}

// Called only with the user's library, never from playback/recommendation requests.
export async function syncLibraryArtwork(playlists, account, isCurrent) {
  if (!window.YesPlayMusicAndroid?.cacheLibraryArtwork || !account) return;
  const epoch = ++generation;
  const current = () => epoch === generation && isCurrent();
  enqueue(playlists.map(playlist => playlist.coverImgUrl));
  for (const playlist of playlists) {
    if (!current()) return;
    const key = `${account}:${playlist.id}`;
    const stamp = JSON.stringify([
      playlist.updateTime,
      playlist.trackUpdateTime,
      playlist.trackCount,
      playlist.coverImgUrl,
    ]);
    try {
      const previous = await manifests.playlists.get(key).catch(() => null);
      if (!current()) return;
      if (previous) enqueue(previous.urls);
      if (previous?.stamp === stamp) continue;
      const { playlist: detail } = await getPlaylistDetail(playlist.id, true);
      if (!current()) return;
      if (!detail || !Array.isArray(detail.trackIds)) continue;
      const urls = new Set([detail.coverImgUrl, playlist.coverImgUrl]);
      const known = new Map(
        (detail.tracks || []).map(track => [String(track.id), track.al?.picUrl])
      );
      const missing = [];
      for (const track of detail.trackIds) {
        const cover = known.get(String(track.id));
        if (cover) urls.add(cover);
        else missing.push(track.id);
      }
      enqueue([...urls]);
      for (let offset = 0; offset < missing.length; offset += 200) {
        if (!current()) return;
        // One request per batch; the playback detail helper also refreshes in background.
        const result = await request({
          url: '/song/detail',
          method: 'get',
          params: { ids: missing.slice(offset, offset + 200).join(',') },
        });
        if (!current()) return;
        if (!Array.isArray(result.songs))
          throw new Error('Missing song artwork data');
        const covers = result.songs.map(track => track.al?.picUrl);
        for (const cover of covers) if (cover) urls.add(cover);
        enqueue(covers);
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      if (!current()) return;
      await manifests.playlists
        .put({ key, stamp, urls: [...urls].filter(Boolean) })
        .catch(() => {});
    } catch (error) {
      // A failed playlist can retry at the next library refresh; other playlists still cache.
      console.debug('Library artwork sync skipped a playlist', error);
    }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
}
