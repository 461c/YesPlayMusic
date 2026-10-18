const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const calls = [];
let reject = false;
const context = {
  module: { exports: {} },
  Buffer,
  URLSearchParams,
  global: {},
  require(name) {
    if (name === 'axios')
      return async config => {
        calls.push(config);
        const filename = config.data
          .toString('latin1')
          .match(/filename="([^"]+)"/)[1];
        return {
          data: { code: 200, data: { successfiles: reject ? [] : [filename] } },
        };
      };
    return require(name);
  },
};
vm.runInNewContext(fs.readFileSync('src/electron/ncbl.js', 'utf8'), context);
const ncbl = context.module.exports;
const sandbox = {
  module: { exports: {} },
  global: {},
  require: name => (name === './ncbl' ? ncbl : require(name)),
};
vm.runInNewContext(
  fs.readFileSync('src/electron/scrobble.js', 'utf8'),
  sandbox
);
(async () => {
  const report = sandbox.module.exports;
  assert.equal((await report({ id: 1, time: 50 })).body.data, 'skipped');
  assert.equal(calls.length, 0);
  const key = Buffer.alloc(32, 5),
    nonce = Buffer.alloc(12, 7),
    iv = Buffer.alloc(16);
  iv.writeUInt32LE(9);
  nonce.copy(iv, 4);
  const body = Buffer.from('actual listening, not seek position');
  const cipher = crypto.createCipheriv('chacha20', key, iv);
  assert(
    ncbl
      .chacha20(key, 9, nonce, body)
      .equals(Buffer.concat([cipher.update(body), cipher.final()]))
  );
  const payload = ncbl.encryptNCBL('{"test":true}', body, {
    keyA: key,
    uuid: Buffer.alloc(16, 1),
    baseSeq: 1,
  });
  assert.equal(payload.subarray(0, 4).toString(), 'NCBL');
  assert.equal(payload.readUInt32LE(4), 3);
  const offset = payload.readUInt16LE(8),
    size = payload.readUInt16LE(offset);
  const compressed = ncbl.chacha20(
    key,
    Buffer.alloc(16, 1).readUInt32LE(12) >>> 2,
    Buffer.alloc(12, 1),
    payload.subarray(offset + 6, offset + 6 + size)
  );
  const zlib = require('zlib');
  const decoded =
    ncbl.getCompress().name === 'gzip'
      ? zlib.gunzipSync(compressed)
      : zlib.zstdDecompressSync(compressed);
  assert(decoded.equals(body), 'NCBL frame must round-trip actual log bytes');
  const result = await report({
    id: 9,
    sourceid: 12,
    time: 65,
    total: 200,
    cookie: 'MUSIC_U=test+token; __csrf=csrf',
  });
  assert.equal(result.body.code, 200);
  assert.equal(calls.length, 2);
  assert(
    calls.every(
      call =>
        call.url ===
        'https://clientlog3.music.163.com/api/clientlog/encrypt/upload?multiupload=true'
    )
  );
  assert(calls[0].headers.Cookie.includes('MUSIC_U=test+token'));
  const ctx = ncbl.extractContext({ MUSIC_U: 'test' });
  const log = ncbl.buildPld(
    ctx,
    { id: 9, time: 200 },
    { id: '12', type: 'track', name: 'list' },
    65
  );
  assert.equal(log.time, 65);
  assert.equal(log.resource_time, 200);
  reject = true;
  const failure = await report({
    id: 9,
    time: 25,
    cookie: { MUSIC_U: 'test' },
  });
  assert.equal(failure.status, 200);
  assert.equal(
    failure.body.code,
    500,
    'HTTP 200 without filename acknowledgement must remain retryable'
  );
  console.log(
    'NetEase history: ChaCha20 vector, encrypted frame roundtrip, exact token, PLV/PLD uploads, guest and false-success handling passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
