import request from '@/utils/request';

// Read-only endpoints in the bundled @neteaseapireborn/api 4.29.7.
export const trackingSections = [
  { key: 'profile', title: '公开资料', url: '/user/detail' },
  { key: 'playlists', title: '歌单', url: '/user/playlist' },
  { key: 'week', title: '最近一周', url: '/user/record', type: 1 },
  { key: 'all', title: '累计排行', url: '/user/record', type: 0 },
  { key: 'events', title: '动态', url: '/user/event' },
  { key: 'follows', title: '关注', url: '/user/follows' },
  { key: 'followers', title: '粉丝', url: '/user/followeds' },
  { key: 'radios', title: '电台', url: '/user/audio' },
];

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
  }).then(data => {
    if (!data || (data.code !== undefined && data.code !== 200)) {
      throw new Error(
        data?.message || data?.msg || '当前内容不可见或接口暂不可用'
      );
    }
    if (section === 'profile' && !data.profile)
      throw new Error('未找到该用户的公开资料');
    return data;
  });
}
