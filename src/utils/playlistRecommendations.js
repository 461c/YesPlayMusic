import request from '@/utils/request';
import { isAccountLoggedIn } from '@/utils/auth';

const pendingDaily = new Map();
const dailyMemory = new Map();
const PAGE_SIZE = 50;
const clean = value =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s\u3000·•\-—_，。！!？?、:：;；"'“”‘’（）()\[\]【】]/g, '');
export function playlistSignature(item) {
  const owner = item.creator?.userId || item.creator?.nickname;
  return owner && item.name ? `${owner}:${clean(item.name)}` : '';
}
function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (_) {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    /* Keep the current result usable if storage is full. */
  }
}
function historyKey(scope, section) {
  return 'playlist-recent:' + JSON.stringify([scope, section]);
}
function historyFor(scope, section) {
  const value = read(historyKey(scope, section), []);
  return Array.isArray(value) ? value.filter(Array.isArray).slice(-4) : [];
}
export function prioritizePlaylists(items, history, limit = 10) {
  const seenIds = new Map(),
    seenNames = new Map();
  history.forEach((batch, age) =>
    batch.forEach(item => {
      if (!item || typeof item !== 'object') return;
      if (item.id != null) seenIds.set(String(item.id), age);
      if (item.signature) seenNames.set(item.signature, age);
    })
  );
  const ids = new Set(),
    names = new Set(),
    fresh = [],
    repeats = [];
  for (const item of items) {
    if (!item || item.id == null || ids.has(String(item.id))) continue;
    const signature = playlistSignature(item);
    if (signature && names.has(signature)) continue;
    ids.add(String(item.id));
    if (signature) names.add(signature);
    const age = Math.max(
      seenIds.get(String(item.id)) ?? -1,
      seenNames.get(signature) ?? -1
    );
    if (age < 0) fresh.push(item);
    else repeats.push({ item, age, order: repeats.length });
  }
  repeats.sort((a, b) => a.age - b.age || a.order - b.order);
  return {
    freshCount: fresh.length,
    items: [...fresh, ...repeats.map(entry => entry.item)].slice(0, limit),
  };
}
export function recommendationDay(now = Date.now()) {
  // NetEase's daily recommendation rollover is 06:00 in China (UTC+8).
  return new Date(now + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
async function api(url, params, field) {
  const data = await request({
    url,
    method: 'get',
    skipAuthRedirect: true,
    params: { ...params, timestamp: Date.now() },
  });
  if (
    !data ||
    (data.code !== undefined && data.code !== 200) ||
    !Array.isArray(data[field])
  )
    throw new Error('歌单暂时无法加载');
  return data;
}
async function personalPool(scope, isCurrent) {
  if (!isAccountLoggedIn()) return [];
  const day = recommendationDay(),
    key = 'playlist-daily:' + scope;
  const cached = dailyMemory.get(scope) || read(key, null);
  if (cached?.day === day && Array.isArray(cached.items)) return cached.items;
  const pendingKey = JSON.stringify([scope, day]);
  let work = pendingDaily.get(pendingKey);
  if (!work) {
    work = api('/recommend/resource', {}, 'recommend')
      .then(data => data.recommend)
      .finally(() => {
        if (pendingDaily.get(pendingKey) === work)
          pendingDaily.delete(pendingKey);
      });
    pendingDaily.set(pendingKey, work);
  }
  const items = await work;
  if (isCurrent()) {
    const value = { day, items };
    dailyMemory.set(scope, value);
    write(key, value);
  }
  return items;
}
export function randomPlaylistPage(total, visited, random = Math.random) {
  const length =
    total == null ? 50 : Math.min(200, Math.ceil(total / PAGE_SIZE));
  const available = Array.from(
    { length: Math.max(0, length) },
    (_, i) => i
  ).filter(i => !visited.has(i));
  return available.length
    ? available[Math.floor(random() * available.length)]
    : null;
}
function shuffle(items) {
  const output = items.slice();
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}
function weave(first, second) {
  const items = [];
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (first[i]) items.push(first[i]);
    if (second[i]) items.push(second[i]);
  }
  return items;
}
async function discoveryPool(history, limit, isCurrent) {
  const hot = [],
    quality = [],
    pages = new Set(),
    cursors = new Set();
  let total = null,
    oldest = Date.now(),
    latest = Date.now(),
    lastError = null;
  for (let attempt = 0; attempt < 10 && isCurrent(); attempt++) {
    const useQuality = attempt === 1 || (attempt > 1 && Math.random() < 0.5);
    let url, params;
    if (useQuality) {
      let before = 0;
      if (cursors.size) {
        const floor = Math.max(1, oldest - 365 * 24 * 60 * 60 * 1000);
        before = Math.floor(
          floor + Math.random() * Math.max(1, latest - floor)
        );
        while (cursors.has(before) && before > 1) before--;
        if (cursors.has(before)) continue;
      }
      cursors.add(before);
      url = '/top/playlist/highquality';
      params = { limit: PAGE_SIZE, before };
    } else {
      const page = randomPlaylistPage(total, pages);
      if (page == null) continue;
      pages.add(page);
      url = '/top/playlist';
      params = {
        cat: '全部',
        order: 'hot',
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      };
    }
    try {
      const data = await api(url, params, 'playlists');
      if (!isCurrent()) return [];
      if (useQuality) {
        const times = data.playlists
          .map(item => Number(item.updateTime))
          .filter(time => time > 0);
        if (times.length) {
          oldest = Math.min(oldest, ...times);
          latest = Math.max(...times);
        }
        quality.push(...shuffle(data.playlists));
      } else {
        if (data.total != null && Number.isFinite(Number(data.total)))
          total = Number(data.total);
        hot.push(...shuffle(data.playlists));
      }
    } catch (error) {
      lastError = error;
      if (attempt > 0) break;
    }
    if (
      attempt >= 1 &&
      prioritizePlaylists(weave(hot, quality), history, limit).freshCount >=
        limit
    )
      break;
  }
  if (!hot.length && !quality.length && lastError) throw lastError;
  return weave(hot, quality);
}
export async function fetchPlaylistRecommendations(
  section,
  { scope, isCurrent = () => true } = {}
) {
  const history = historyFor(scope, section.key),
    limit = section.params?.limit || 10;
  const pool =
    section.key === 'recommend'
      ? await personalPool(scope, isCurrent)
      : await discoveryPool(history, limit, isCurrent);
  if (!isCurrent()) return [];
  const result = prioritizePlaylists(pool, history, limit).items;
  if (section.key !== 'recommend' || isAccountLoggedIn())
    write(
      historyKey(scope, section.key),
      [
        ...history,
        result.map(item => ({
          id: String(item.id),
          signature: playlistSignature(item),
        })),
      ].slice(-4)
    );
  return result;
}
