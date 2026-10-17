import { getTrackSource } from './db';

// Preserve metadata independently of whether an audio file has been downloaded.
export async function retainTracks(
  fresh,
  previous = [],
  knownIds = null,
  missingStatus = 'removed'
) {
  const old = new Map(previous.map(track => [String(track.id), track]));
  const ids = new Set(fresh.map(track => String(track.id)));
  const known =
    knownIds && new Set(knownIds.map(item => String(item.id ?? item)));
  const result = fresh.map(track => ({
    ...old.get(String(track.id)),
    ...track,
    archiveStatus: undefined,
    localOnly: false,
    localPlayable: false,
  }));
  for (const track of previous) {
    if (ids.has(String(track.id)) || (known && known.has(String(track.id))))
      continue;
    ids.add(String(track.id));
    result.push({
      ...track,
      archiveStatus: missingStatus,
      playable: missingStatus === 'removed' ? false : track.playable,
      reason: missingStatus === 'removed' ? '已移除或不可见' : track.reason,
    });
  }
  for (const track of result) {
    const unavailable =
      track.archiveStatus === 'removed' ||
      track.playable === false ||
      track.noCopyrightRcmd ||
      track.privilege?.st < 0 ||
      track.privilege?.pl === 0;
    if (!unavailable) continue;
    let state = 0;
    try {
      const native = window.YesPlayMusicAndroid;
      if (native?.preserveCachedTrack)
        state = Number(native.preserveCachedTrack(String(track.id)));
      else if (process.env.IS_ELECTRON && (await getTrackSource(track.id))) {
        state = 2;
        const pinned = JSON.parse(
          localStorage.getItem('preserved-audio') || '[]'
        );
        localStorage.setItem(
          'preserved-audio',
          JSON.stringify([...new Set([...pinned, String(track.id)])])
        );
      }
    } catch (_) {
      /* Metadata remains usable even when audio cache cannot be inspected. */
    }
    track.localOnly = state > 0;
    track.localPlayable = state === 2;
    track.playable = track.localPlayable;
    track.reason = state
      ? state === 2
        ? '仅本地'
        : '仅本地（部分缓存）'
      : track.reason || '已移除或不可用';
  }
  return result;
}
