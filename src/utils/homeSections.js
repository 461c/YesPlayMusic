const songs = (key, title, type) => ({
  key,
  title,
  type: 'songs',
  url: '/top/song',
  field: 'data',
  params: { type },
});
export const homeSectionCatalog = [
  {
    key: 'recommend',
    title: '为你推荐',
    type: 'recommend',
    default: true,
    params: { limit: 10 },
  },
  {
    key: 'discoverPlaylists',
    title: '发现歌单',
    type: 'playlist',
    default: true,
    params: { limit: 10 },
    more: '/explore?category=全部',
  },
  { key: 'forYou', title: 'For You', type: 'forYou', default: true },
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
    key: 'newSongs',
    title: '推荐新歌',
    type: 'newSongs',
    url: '/personalized/newsong',
    field: 'result',
    params: { limit: 10 },
    default: true,
  },
  songs('newChinese', '华语新歌', 7),
  songs('newWestern', '欧美新歌', 96),
  songs('newJapanese', '日语新歌', 8),
  songs('newKorean', '韩语新歌', 16),
];
const known = new Set(homeSectionCatalog.map(item => item.key));
const oldPlaylistKeys = new Set([
  'highQuality',
  'hot',
  'chinese',
  'western',
  'japanese',
  'korean',
  'light',
  'electronic',
  'rock',
  'folk',
  'rap',
  'classical',
  'jazz',
  'acg',
]);
export function normalizeHomeSections(value) {
  const entries = Array.isArray(value)
    ? value
    : homeSectionCatalog.filter(item => item.default).map(item => item.key);
  return [
    ...new Set(
      entries
        .map(key => (oldPlaylistKeys.has(key) ? 'discoverPlaylists' : key))
        .filter(key => known.has(key))
    ),
  ];
}
export function homeSections(settings) {
  return normalizeHomeSections(settings.homeSections).map(key =>
    homeSectionCatalog.find(item => item.key === key)
  );
}
