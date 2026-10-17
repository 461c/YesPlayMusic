import request from '@/utils/request';

// Read-only endpoints in the bundled @neteaseapireborn/api 4.29.7.
export const trackingSections = [
  { key: 'profile', title: '公开资料', url: '/user/detail' },
  { key: 'playlists', title: '歌单', url: '/user/playlist' },
  { key: 'week', title: '最近一周', url: '/user/record', type: 1 },
  { key: 'all', title: '累计排行', url: '/user/record', type: 0 },
  { key: 'follows', title: '关注', url: '/user/follows' },
  { key: 'fans', title: '粉丝', url: '/user/followeds' },
  { key: 'likes', title: '喜欢的音乐', url: '/playlist/detail' },
  { key: 'events', title: '动态', url: '/user/event' },
];

export function usableBackground(url) {
  return (
    typeof url === 'string' &&
    /^https?:\/\//.test(url) &&
    !/109951162868128395|109951162868126486/.test(url)
  );
}
export function readTrackingSection(uid, section, cursor = {}) {
  const item = trackingSections.find(item => item.key === section);
  return request({
    url: item.url,
    method: 'get',
    // A denied public profile request must not log the viewer out.
    skipAuthRedirect: true,
    params: {
      uid,
      limit: 30,
      ...cursor,
      ...(item.type === undefined ? {} : { type: item.type }),
    },
  }).then(async data => {
    if (!data || (data.code !== undefined && data.code !== 200)) {
      throw new Error(
        data?.message || data?.msg || '当前内容不可见或接口暂不可用'
      );
    }
    const listKey = {
      playlists: 'playlist',
      week: 'weekData',
      all: 'allData',
      follows: 'follow',
      fans: 'followeds',
      events: 'events',
    }[section];
    if (
      (listKey && !Array.isArray(data[listKey])) ||
      (section === 'likes' && !data.playlist)
    )
      throw new Error('当前内容不可见或接口返回不完整，保留本地副本');
    if (section === 'profile' && !data.profile)
      throw new Error('未找到该用户的公开资料');
    if (
      section === 'profile' &&
      !usableBackground(data.profile.backgroundUrl)
    ) {
      try {
        const alternate = await request({
          url: '/user/detail/new',
          method: 'get',
          skipAuthRedirect: true,
          params: { uid, timestamp: Date.now() },
        });
        const profile =
          alternate?.profile || alternate?.data?.profile || alternate?.data;
        if (usableBackground(profile?.backgroundUrl))
          data.profile.backgroundUrl = profile.backgroundUrl;
      } catch (_) {
        /* Preserve the standard profile; the view falls back to its avatar. */
      }
    }
    return data;
  });
}
