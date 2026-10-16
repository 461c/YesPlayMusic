const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let state = 'starting',
  sent = 0;
const listeners = new Map();
const window = {
  addEventListener(name, callback) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(callback);
  },
  removeEventListener(name, callback) {
    listeners.get(name)?.delete(callback);
  },
  YesPlayMusicAndroid: {
    getApiStartupState: () => state,
    request(id) {
      sent++;
      for (const cb of listeners.get('yesplaymusic-api-response') || [])
        cb({ detail: { id, status: 200, data: '{}' } });
    },
  },
};
const fire = () => {
  for (const callback of [...(listeners.get('yesplaymusic-api-startup') || [])])
    callback({});
};
const source = fs
  .readFileSync('src/utils/androidApi.js', 'utf8')
  .replace("import axios from 'axios';", '')
  .replace('export default async function', 'async function');
class Cancel extends Error {}
const context = {
  window,
  axios: { getUri: config => config.url, Cancel },
  FormData: class {},
  setTimeout,
  clearTimeout,
  module: {},
};
vm.runInNewContext(source + '\nmodule.adapter = androidApiAdapter;', context);
const config = () => ({
  url: '/hello',
  baseURL: '/api',
  headers: {},
  timeout: 5,
});
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  let settled = false;
  const request = context.module
    .adapter(config())
    .finally(() => (settled = true));
  await delay(25);
  assert.equal(sent, 0);
  assert.equal(settled, false, 'API startup must not consume the HTTP timeout');
  state = 'ready';
  fire();
  assert.equal((await request).status, 200);
  assert.equal(sent, 1);
  assert.equal(listeners.get('yesplaymusic-api-startup').size, 0);
  state = 'starting';
  const failureConfig = config();
  const failure = context.module.adapter(failureConfig);
  state = 'error';
  fire();
  await assert.rejects(
    failure,
    error => error.config === failureConfig && error.code === 'ERR_NETWORK'
  );
  assert.equal(sent, 1);
  state = 'starting';
  const abort = new AbortController();
  const canceled = context.module.adapter({
    ...config(),
    signal: abort.signal,
  });
  abort.abort();
  await assert.rejects(canceled, error => error instanceof Cancel);
  assert.equal(sent, 1);
  assert.equal(listeners.get('yesplaymusic-api-startup').size, 0);
  let reads = 0;
  window.YesPlayMusicAndroid.getApiStartupState = () =>
    ++reads === 1 ? 'starting' : 'ready';
  assert.equal(
    (await context.module.adapter(config())).status,
    200,
    'Completing between state read and event registration must not hang'
  );
  console.log(
    'Android startup: deferred requests, separate HTTP deadline, failure, cancellation and readiness race passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
