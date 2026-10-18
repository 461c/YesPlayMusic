import axios from 'axios';

let sequence = 0;
const pending = new Map();
window.addEventListener('yesplaymusic-api-response', event => {
  const result = event.detail;
  const callback = pending.get(result.id);
  if (callback) callback(result);
});

function base64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Interface deployment must not block rendering or consume the HTTP request timeout.
function waitForApi(config) {
  const bridge = window.YesPlayMusicAndroid;
  if (!bridge.getApiStartupState || bridge.getApiStartupState() === 'ready')
    return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('yesplaymusic-api-startup', check);
      config.signal?.removeEventListener('abort', abort);
      config.cancelToken?.unsubscribe(abort);
    };
    const fail = message => {
      cleanup();
      const error = new Error(message);
      error.config = config;
      error.code = 'ERR_NETWORK';
      reject(error);
    };
    const abort = () => {
      cleanup();
      reject(new axios.Cancel('Request canceled'));
    };
    const check = () => {
      const state = bridge.getApiStartupState();
      if (state === 'ready') {
        cleanup();
        resolve();
      } else if (state === 'error') fail('本地音乐接口启动失败');
    };
    timer = setTimeout(() => fail('本地音乐接口启动超时'), 60000);
    window.addEventListener('yesplaymusic-api-startup', check);
    config.signal?.addEventListener('abort', abort);
    config.cancelToken?.subscribe(abort);
    if (config.signal?.aborted || config.cancelToken?.reason) return abort();
    check(); // Covers startup finishing between the first read and listener registration.
  });
}

export default async function androidApiAdapter(config) {
  await waitForApi(config);
  const request = {
    url: axios.getUri({
      ...config,
      baseURL: undefined,
      url: `${(config.baseURL || '').replace(/\/+$/, '')}/${config.url.replace(
        /^\/+/,
        ''
      )}`,
    }),
    method: (config.method || 'get').toUpperCase(),
    timeout: Math.min(300000, Math.max(15000, Number(config.timeout) || 15000)),
    headers: { ...config.headers },
  };
  if (config.data instanceof FormData) {
    const boundary = `----YesPlayMusic${Date.now()}${++sequence}`;
    const parts = [];
    const escape = value => String(value).replace(/["\r\n]/g, '_');
    for (const [name, value] of config.data.entries()) {
      parts.push(
        `--${boundary}\r\nContent-Disposition: form-data; name="${escape(
          name
        )}"`
      );
      if (value instanceof Blob) {
        parts.push(
          `; filename="${escape(value.name || 'upload')}"\r\nContent-Type: ${
            value.type || 'application/octet-stream'
          }\r\n\r\n`,
          value
        );
      } else parts.push(`\r\n\r\n${value}`);
      parts.push('\r\n');
    }
    parts.push(`--${boundary}--\r\n`);
    request.bodyBase64 = await base64(new Blob(parts));
    request.headers[
      'Content-Type'
    ] = `multipart/form-data; boundary=${boundary}`;
  } else if (config.data != null) {
    request.body = String(config.data);
  }
  return new Promise((resolve, reject) => {
    const id = String(++sequence);
    let timer;
    const cleanup = () => {
      pending.delete(id);
      clearTimeout(timer);
      config.signal?.removeEventListener('abort', abort);
      config.cancelToken?.unsubscribe(abort);
    };
    const fail = (message, code) => {
      cleanup();
      const error = new Error(message);
      error.config = config;
      error.code = code;
      reject(error);
    };
    const abort = () => {
      cleanup();
      reject(new axios.Cancel('Request canceled'));
    };
    pending.set(id, result => {
      cleanup();
      if (result.error) return fail(result.error, 'ERR_NETWORK');
      const response = {
        data: result.data,
        status: result.status,
        statusText: String(result.status),
        headers: result.headers || {},
        config,
      };
      if (!config.validateStatus || config.validateStatus(response.status)) {
        resolve(response);
      } else {
        const error = new Error(
          `Request failed with status code ${response.status}`
        );
        error.config = config;
        error.response = response;
        reject(error);
      }
    });
    if (config.timeout > 0)
      timer = setTimeout(
        () => fail(`timeout of ${config.timeout}ms exceeded`, 'ECONNABORTED'),
        config.timeout
      );
    config.signal?.addEventListener('abort', abort);
    config.cancelToken?.subscribe(abort);
    if (config.signal?.aborted || config.cancelToken?.reason) return abort();
    try {
      window.YesPlayMusicAndroid.request(id, JSON.stringify(request));
    } catch (error) {
      fail(error.message, 'ERR_NETWORK');
    }
  });
}
