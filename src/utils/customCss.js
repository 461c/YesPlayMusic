let activeSheet = null;
let watcher = null;
let reloadTimer = null;
let loadVersion = 0;

function stopWatching() {
  if (watcher) watcher.close();
  watcher = null;
  clearTimeout(reloadTimer);
}

function resolveAddress(address) {
  address = address.trim().replace(/^(["'])(.*)\1$/, '$2');
  if (/^https?:\/\//i.test(address)) {
    return { url: new URL(address), filePath: null };
  }
  if (process.env.IS_ELECTRON !== true) {
    throw new Error('settings.customCss.localOnly');
  }
  const path = window.require('path');
  const { fileURLToPath, pathToFileURL } = window.require('url');
  if (/^file:\/\//i.test(address)) address = fileURLToPath(address);
  if (/^~[\\/]/.test(address)) {
    address = path.join(window.require('os').homedir(), address.slice(2));
  }
  if (!path.isAbsolute(address)) {
    throw new Error('settings.customCss.invalidAddress');
  }
  return { url: pathToFileURL(address), filePath: address };
}

function resolveLocalUrls(css, baseUrl) {
  const resolve = value =>
    /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)
      ? value
      : new URL(value, baseUrl).href;
  return css
    .replace(
      /url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi,
      (match, doubleQuoted, singleQuoted, unquoted) => {
        const value = doubleQuoted ?? singleQuoted ?? unquoted;
        return value ? `url("${resolve(value)}")` : match;
      }
    )
    .replace(
      /(@import\s+)(["'])([^"']+)\2/gi,
      (match, prefix, quote, value) => {
        return `${prefix}${quote}${resolve(value)}${quote}`;
      }
    );
}

export async function applyCustomCss(address, onError = () => {}) {
  const version = ++loadVersion;
  address = (address || '').trim();
  stopWatching();
  if (!address) {
    if (activeSheet) activeSheet.remove();
    activeSheet = null;
    return;
  }

  let sheet;
  try {
    const { url, filePath } = resolveAddress(address);
    if (filePath) {
      const fs = window.require('fs');
      const css = await fs.promises.readFile(filePath, 'utf8');
      sheet = document.createElement('style');
      sheet.textContent = resolveLocalUrls(css, url.href);
    } else {
      sheet = document.createElement('link');
      sheet.rel = 'stylesheet';
      sheet.media = 'not all';
      url.searchParams.set('_yesplaymusic_css', Date.now().toString());
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error('settings.customCss.loadFailed'));
        }, 15000);
        sheet.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        sheet.onerror = () => {
          clearTimeout(timer);
          reject(new Error('settings.customCss.loadFailed'));
        };
        sheet.href = url.href;
        document.head.appendChild(sheet);
      });
    }

    if (version !== loadVersion) {
      sheet.remove();
      return;
    }
    if (activeSheet) activeSheet.remove();
    sheet.id = 'yesplaymusic-custom-css';
    sheet.media = 'all';
    document.head.appendChild(sheet);
    activeSheet = sheet;
    stopWatching();

    if (filePath) {
      const fs = window.require('fs');
      const path = window.require('path');
      try {
        watcher = fs.watch(path.dirname(filePath), (_, filename) => {
          if (filename && filename.toString() !== path.basename(filePath))
            return;
          clearTimeout(reloadTimer);
          reloadTimer = setTimeout(() => {
            applyCustomCss(address, onError).catch(onError);
          }, 200);
        });
        watcher.on('error', () => {
          stopWatching();
          onError(new Error('settings.customCss.loadFailed'));
        });
      } catch (error) {
        // The stylesheet remains usable through the manual reload button.
        console.warn('Unable to watch the custom CSS file', error);
      }
    }
  } catch (error) {
    if (sheet) sheet.remove();
    if (version !== loadVersion) return;
    throw error;
  }
}

// Keep user styles after stylesheets added by lazy-loaded views.
const observer = new MutationObserver(mutations => {
  if (
    activeSheet &&
    mutations.some(mutation =>
      Array.from(mutation.addedNodes).some(
        node =>
          node !== activeSheet &&
          (node.nodeName === 'STYLE' ||
            (node.nodeName === 'LINK' && node.rel === 'stylesheet'))
      )
    )
  ) {
    document.head.appendChild(activeSheet);
  }
});
observer.observe(document.head, { childList: true });
