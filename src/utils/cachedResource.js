import { archiveMode, archiveError } from './archiveMode';
// Read local data before refreshing; every caller owns at most one network request.
export async function cachedResource(read, load) {
  const cached = await Promise.resolve()
    .then(read)
    .catch(() => null);
  if (cached != null) {
    if (!archiveMode() && navigator.onLine !== false)
      Promise.resolve()
        .then(load)
        .catch(() => {});
    return cached;
  }
  if (archiveMode()) throw archiveError();
  if (navigator.onLine === false)
    throw new Error('该内容尚未保存在本地，请联网加载一次');
  return load();
}
