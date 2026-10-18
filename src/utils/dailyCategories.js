import request from '@/utils/request';
import { getTrackDetail } from '@/api/track';
import { mapTrackPlayableStatus } from '@/utils/common';

// Preserve server category names and IDs. Never interpret a category ID as a song ID.
export function categoryGroups(response) {
  const groups = [];
  const visit = (node, inherited = '风格推荐', depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 6) return;
    if (Array.isArray(node)) {
      node.forEach(item => visit(item, inherited, depth + 1));
      return;
    }
    const title =
      node.categoryName || node.tagName || node.title || node.name || inherited;
    for (const key of [
      'songs',
      'songList',
      'dailySongs',
      'songIds',
      'recommendSongs',
      'tracks',
      'categorySongs',
    ]) {
      if (!Array.isArray(node[key])) continue;
      const songs = node[key].map(item => item?.song || item?.songInfo || item);
      const ids = [
        ...new Set(
          songs
            .map(item =>
              String(
                typeof item === 'object' ? item.id || item.songId || '' : item
              )
            )
            .filter(id => /^[1-9]\d*$/.test(id))
        ),
      ];
      if (ids.length)
        groups.push({
          key: String(
            node.categoryId || node.tagId || node.id || groups.length
          ),
          title: String(title),
          ids,
          songs: songs.filter(song => song?.name && (song.al || song.album)),
        });
    }
    for (const [key, value] of Object.entries(node)) {
      if (
        ![
          'songs',
          'songList',
          'dailySongs',
          'songIds',
          'recommendSongs',
          'tracks',
          'categorySongs',
        ].includes(key)
      )
        visit(value, title, depth + 1);
    }
  };
  visit(response);
  return groups.filter(
    (group, i) => groups.findIndex(other => other.key === group.key) === i
  );
}
export async function fetchDailyCategories() {
  const response = await request({
    url: '/recommend/category/songs',
    timeout: 45000,
    skipAuthRedirect: true,
    params: { timestamp: Date.now() },
  });
  if (response.code !== 200)
    throw new Error(response.message || '分类推荐暂不可用');
  const groups = categoryGroups(response);
  if (!groups.length) throw new Error('当前账号未返回分类歌曲');
  return groups;
}
export async function categoryTracks(group) {
  const known = new Map(group.songs.map(song => [String(song.id), song]));
  const missing = group.ids.filter(id => !known.has(id));
  for (let offset = 0; offset < missing.length; offset += 50) {
    const response = await getTrackDetail(
      missing.slice(offset, offset + 50).join(',')
    );
    for (const song of response.songs || []) known.set(String(song.id), song);
  }
  return mapTrackPlayableStatus(
    group.ids.map(id => known.get(id)).filter(Boolean)
  );
}
