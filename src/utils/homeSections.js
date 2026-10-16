const playlist = (key, title, cat, extra = {}) => ({
  key,
  title,
  type: 'playlist',
  url: '/top/playlist',
  field: 'playlists',
  params: { cat, limit: 10, order: 'hot' },
  more: `/explore?category=${encodeURIComponent(cat)}`,
  ...extra,
});
const songs = (key, title, type) => ({
  key,
  title,
  type: 'songs',
  url: '/top/song',
  field: 'data',
  params: { type },
});
export const homeSectionCatalog = [
  { key: 'apple', title: 'Apple Music 精选', type: 'apple', default: true },
  {
    key: 'recommend',
    title: '推荐歌单',
    type: 'recommend',
    default: true,
    more: '/explore?category=推荐歌单',
  },
  { key: 'forYou', title: '每日推荐与私人 FM', type: 'forYou', default: true },
  {
    key: 'artists',
    title: '推荐歌手',
    type: 'artist',
    url: '/top/artists',
    field: 'artists',
    params: { limit: 6 },
    default: true,
  },
  {
    key: 'albums',
    title: '最新专辑',
    type: 'album',
    url: '/album/newest',
    field: 'albums',
    default: true,
    more: '/new-album',
  },
  {
    key: 'charts',
    title: '排行榜',
    type: 'charts',
    default: true,
    more: '/explore?category=排行榜',
  },
  {
    key: 'highQuality',
    title: '精品歌单',
    type: 'playlist',
    url: '/top/playlist/highquality',
    field: 'playlists',
    params: { limit: 10 },
    more: '/explore?category=精品歌单',
    default: true,
  },
  {
    key: 'newSongs',
    title: '推荐新歌',
    type: 'newSongs',
    url: '/personalized/newsong',
    field: 'result',
    params: { limit: 10 },
    default: true,
  },
  playlist('hot', '热门歌单', '全部'),
  playlist('chinese', '华语精选', '华语'),
  playlist('western', '欧美精选', '欧美'),
  playlist('japanese', '日语精选', '日语'),
  playlist('korean', '韩语精选', '韩语'),
  playlist('light', '轻音乐', '轻音乐'),
  playlist('electronic', '电子', '电子'),
  playlist('rock', '摇滚', '摇滚'),
  playlist('folk', '民谣', '民谣'),
  playlist('rap', '说唱', '说唱'),
  playlist('classical', '古典', '古典'),
  playlist('jazz', '爵士', '爵士'),
  playlist('acg', 'ACG', 'ACG'),
  playlist('relax', '治愈', '治愈'),
  playlist('workout', '运动', '运动'),
  songs('newChinese', '华语新歌', 7),
  songs('newWestern', '欧美新歌', 96),
  songs('newJapanese', '日语新歌', 8),
  songs('newKorean', '韩语新歌', 16),
  {
    key: 'recommendedMV',
    title: '推荐 MV',
    type: 'mv',
    url: '/personalized/mv',
    field: 'result',
    default: true,
  },
  {
    key: 'latestMV',
    title: '最新 MV',
    type: 'mv',
    url: '/mv/first',
    field: 'data',
    params: { limit: 8 },
  },
];
const known = new Set(homeSectionCatalog.map(item => item.key));
export function normalizeHomeSections(value, apple = true) {
  const entries = Array.isArray(value)
    ? value
    : homeSectionCatalog
        .filter(
          item => item.default && (item.key !== 'apple' || apple !== false)
        )
        .map(item => item.key);
  return [...new Set(entries.filter(key => known.has(key)))];
}
export function homeSections(settings) {
  return normalizeHomeSections(
    settings.homeSections,
    settings.showPlaylistsByAppleMusic
  ).map(key => homeSectionCatalog.find(item => item.key === key));
}
