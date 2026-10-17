export function eventTime(item) {
  return Number(item.eventTime || item.showTime || 0);
}
export function eventData(item) {
  try {
    return typeof item.json === 'string'
      ? JSON.parse(item.json)
      : item.json || {};
  } catch (_) {
    return {};
  }
}
// Absence is evidence only inside the successfully returned chronological window.
// Never treat a failed request, an unvisited page or a privacy change as confirmed deletion.
export function mergeTrackingEvents(previous, incoming, cursor = {}) {
  const old = previous?.events || [];
  const fresh = incoming.events || [];
  const ids = new Set(fresh.map(item => String(item.id)));
  const times = fresh.map(eventTime).filter(time => time > 0);
  const upper =
    Number(cursor.lasttime) > 0 ? Number(cursor.lasttime) : Infinity;
  const lower = incoming.more
    ? times.length
      ? Math.min(...times)
      : Infinity
    : 0;
  const checkedAt = Date.now();
  const retained = old
    .filter(item => !ids.has(String(item.id)))
    .map(item => {
      const time = eventTime(item);
      const covered = time > 0 && time <= upper && time >= lower;
      return covered
        ? {
            ...item,
            archiveStatus: 'unavailable',
            missingSince: item.missingSince || checkedAt,
          }
        : item;
    });
  const events = [
    ...fresh.map(item => ({
      ...item,
      archiveStatus: undefined,
      missingSince: undefined,
    })),
    ...retained,
  ].sort((a, b) => eventTime(b) - eventTime(a));
  return { ...incoming, events };
}
