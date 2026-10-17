const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const calls = [];
let rejected = false;
const context = {
  module: { exports: {} },
  global: {},
  URLSearchParams,
  console: { error() {} },
  require(name) {
    if (name === 'axios')
      return async config => {
        calls.push(config);
        return { data: { code: rejected ? 500 : 200 } };
      };
    if (name.endsWith('/util/crypto'))
      return {
        eapi: (path, body) => {
          assert.equal(path, '/api/feedback/weblog');
          return { params: JSON.stringify(body) };
        },
      };
    if (name.endsWith('/util'))
      return { generateDeviceId: () => 'device-for-test' };
    throw new Error(name);
  },
};
vm.runInNewContext(
  fs.readFileSync('src/electron/scrobble.js', 'utf8'),
  context
);
(async () => {
  const report = context.module.exports;
  const guest = await report({ id: 1, time: 50 });
  assert.equal(guest.body.data, 'skipped');
  assert.equal(calls.length, 0);
  const result = await report({
    id: 9,
    sourceid: -1,
    time: 65,
    cookie: 'MUSIC_U=test; __csrf=csrf;',
  });
  assert.equal(result.body.code, 200);
  assert.equal(calls.length, 2);
  assert(
    calls.every(
      call =>
        call.url === 'https://clientlog.music.163.com/eapi/feedback/weblog'
    )
  );
  const logs = calls.map(
    call =>
      JSON.parse(
        JSON.parse(new URLSearchParams(call.data).get('params')).logs
      )[0]
  );
  assert.equal(logs[0].action, 'startplay');
  assert.equal(logs[1].action, 'play');
  assert.equal(logs[1].json.time, 65);
  assert.equal(logs[1].json.sourceId, '0');
  assert.equal(logs[1].json.end, 'playend');
  rejected = true;
  const failure = await report({
    id: 9,
    time: 25,
    cookie: { MUSIC_U: 'test' },
  });
  assert.equal(failure.status, 200, 'Failure must not log the listener out');
  assert.equal(failure.body.code, 500, 'Failure must remain visible for retry');
  assert(
    fs
      .readFileSync('android/api/server.js', 'utf8')
      .includes("require('./scrobble')")
  );
  assert(
    fs
      .readFileSync('scripts/bundle-android-api.cjs', 'utf8')
      .includes("'src/electron/scrobble.js'")
  );
  console.log(
    'NetEase history: clientlog start/end payload, real time, guest skip, rejected result and bundled override passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
