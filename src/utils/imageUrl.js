export function resizedArtwork(address, size = 512) {
  if (!address) return '';
  try {
    const url = new URL(address);
    if (url.protocol === 'http:') url.protocol = 'https:';
    url.searchParams.set('param', `${size}y${size}`);
    return url.href;
  } catch (_) {
    return address;
  }
}
