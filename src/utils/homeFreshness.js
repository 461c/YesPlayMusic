export const HOME_CONTENT_TTL = 30 * 60 * 1000;
export function homeContentFresh(updatedAt, now = Date.now()) {
  return (
    updatedAt > 0 && now >= updatedAt && now - updatedAt < HOME_CONTENT_TTL
  );
}
