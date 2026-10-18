export function entryId(item) {
  return String(item?.id ?? item?.songId ?? item?.userId ?? '');
}
export function retainCollection(fresh, previous = [], markMissing = true) {
  if (!Array.isArray(fresh)) return previous;
  const seen = new Set();
  const result = fresh
    .filter(item => {
      const id = entryId(item);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map(item => ({ ...item, archiveStatus: undefined }));
  for (const item of previous) {
    const id = entryId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push({
      ...item,
      ...(markMissing ? { archiveStatus: 'removed' } : {}),
    });
  }
  return result;
}
