import request from '@/utils/request';
import { fetchPlaylistRecommendations } from '@/utils/playlistRecommendations';
export async function fetchHomeSection(section, options) {
  if (section.type === 'forYou') return [];
  if (['playlist', 'recommend'].includes(section.type))
    return fetchPlaylistRecommendations(section, options);
  const result = await request({
    url: section.url || '/toplist',
    method: 'get',
    params: { ...section.params, timestamp: Date.now() },
    skipAuthRedirect: true,
  });
  if (!result || (result.code !== undefined && result.code !== 200))
    throw new Error('栏目暂时无法加载');
  if (section.type === 'charts')
    return (result.list || []).filter(item =>
      [19723756, 180106, 60198, 3812895, 60131].includes(item.id)
    );
  const items = result[section.field];
  if (!Array.isArray(items)) throw new Error('栏目暂时无法加载');
  if (section.type === 'songs' || section.type === 'newSongs')
    return items.slice(0, 10).map(item => {
      const song = item.song || item;
      return {
        ...song,
        al: song.al || song.album || {},
        ar: song.ar || song.artists || [],
        dt: song.dt || song.duration || 0,
      };
    });
  return items.slice(0, section.type === 'mv' ? 8 : 10);
}
