// Desktop counterpart of Android's on-demand artwork cache. No playlist crawling.
let bridge;
export function artworkBridge() {
  if (window.YesPlayMusicAndroid) return window.YesPlayMusicAndroid;
  if (!process.env.IS_ELECTRON) return null;
  if (bridge) return bridge;
  const fs = window.require('fs');
  const path = window.require('path');
  const crypto = window.require('crypto');
  const { pathToFileURL } = window.require('url');
  const dir = path.join(
    window.require('electron').remote.app.getPath('userData'),
    'library-artwork'
  );
  fs.mkdirSync(dir, { recursive: true });
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('desktop-artwork-allowed') || '[]');
  } catch (_) {
    /* Recover a damaged optional catalog. */
  }
  const allowed = new Set(Array.isArray(saved) ? saved : []);
  const pending = new Map();
  const progressListeners = new Map();
  const stats = { hits: 0, downloads: 0, failures: 0 };
  let generation = 0;
  const identity = address => {
    try {
      const url = new URL(address);
      if (
        !/^https?:$/.test(url.protocol) ||
        !/(^|\.)(music\.126\.net|music\.163\.com)$/.test(url.hostname)
      )
        return null;
      return url.pathname;
    } catch (_) {
      return null;
    }
  };
  const file = address => {
    const id = identity(address);
    if (!id) return null;
    return path.join(
      dir,
      crypto
        .createHash('sha256')
        .update(
          id +
            ':' +
            (() => {
              const size =
                Number(
                  (new URL(address).searchParams.get('param') || '1024').split(
                    'y'
                  )[0]
                ) || 1024;
              return size <= 224 ? 224 : size <= 512 ? 512 : 1024;
            })()
        )
        .digest('hex') + '.img'
    );
  };
  const allow = json => {
    for (const address of JSON.parse(json)) {
      const id = identity(address);
      if (id) allowed.add(id);
    }
    localStorage.setItem(
      'desktop-artwork-allowed',
      JSON.stringify([...allowed])
    );
  };
  bridge = {
    cacheLibraryArtwork: allow,
    allowLibraryArtwork: allow,
    resetArtworkEligibility() {
      allowed.clear();
      localStorage.removeItem('desktop-artwork-allowed');
    },
    lookup(address) {
      const exact = file(address);
      if (!exact) return address;
      const candidates = [exact];
      const variant = new URL(address);
      for (const size of [1024, 512, 224]) {
        variant.searchParams.set('param', `${size}y${size}`);
        candidates.push(file(variant.href));
      }
      for (const target of new Set(candidates)) {
        if (target && fs.existsSync(target)) {
          stats.hits++;
          return pathToFileURL(target).href;
        }
      }
      return address;
    },
    remember(address, strict = false, onDownloadProgress) {
      const id = identity(address),
        target = file(address);
      if (!id || !allowed.has(id) || !target) return Promise.resolve(false);
      if (fs.existsSync(target)) return Promise.resolve(true);
      if (pending.has(target)) {
        if (onDownloadProgress)
          progressListeners.get(target)?.add(onDownloadProgress);
        return pending.get(target);
      }
      // Memorial/offline reads never start a new image download.
      if (
        JSON.parse(localStorage.getItem('settings') || '{}').archiveMode ||
        navigator.onLine === false
      )
        return;
      if (onDownloadProgress)
        progressListeners.set(target, new Set([onDownloadProgress]));
      const epoch = generation;
      const reportProgress = event =>
        progressListeners.get(target)?.forEach(listener => listener(event));
      const work = fetch(address, { cache: 'force-cache' })
        .then(async response => {
          if (
            !response.ok ||
            !/^image\//i.test(response.headers.get('content-type') || '')
          )
            throw new Error('image unavailable');
          if (Number(response.headers.get('content-length')) > 16777216)
            throw new Error('image too large');
          let bytes;
          const total = Number(response.headers.get('content-length')) || 0;
          if (response.body?.getReader) {
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              loaded += value.byteLength;
              if (loaded > 16777216) {
                await reader.cancel();
                throw new Error('image too large');
              }
              chunks.push(Buffer.from(value));
              reportProgress({ loaded, total });
            }
            bytes = Buffer.concat(chunks, loaded);
          } else {
            bytes = Buffer.from(await response.arrayBuffer());
            reportProgress({ loaded: bytes.length, total });
          }
          if (epoch !== generation || bytes.length > 16777216) return;
          await fs.promises.writeFile(target, bytes);
          stats.downloads++;
          return true;
        })
        .catch(error => {
          stats.failures++;
          if (strict) throw error;
          return false;
        })
        .finally(() => {
          pending.delete(target);
          progressListeners.delete(target);
        });
      pending.set(target, work);
      return work;
    },
    clearArtworkCache() {
      generation++;
      for (const name of fs.readdirSync(dir))
        if (/^[a-f0-9]{64}\.img$/.test(name))
          fs.unlinkSync(path.join(dir, name));
    },
    getArtworkCacheStats() {
      let bytes = 0,
        count = 0;
      for (const name of fs.readdirSync(dir))
        if (/^[a-f0-9]{64}\.img$/.test(name)) {
          bytes += fs.statSync(path.join(dir, name)).size;
          count++;
        }
      return JSON.stringify({ ...stats, bytes, count, pending: pending.size });
    },
  };
  return bridge;
}
