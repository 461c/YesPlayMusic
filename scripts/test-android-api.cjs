const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const axios = require('axios');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');

async function testAdapter() {
  let listener;
  let nativeRequest;
  class Blob {
    constructor(parts, options = {}) {
      this.bytes = Buffer.concat(
        parts.map(part =>
          part instanceof Blob ? part.bytes : Buffer.from(part)
        )
      );
      this.type = options.type || '';
    }
  }
  class FormData {
    constructor() {
      this.values = [];
    }
    append(...entry) {
      this.values.push(entry);
    }
    entries() {
      return this.values[Symbol.iterator]();
    }
  }
  class FileReader {
    readAsDataURL(blob) {
      this.result =
        'data:application/octet-stream;base64,' + blob.bytes.toString('base64');
      this.onload();
    }
  }
  const window = {
    addEventListener(name, callback) {
      listener = callback;
    },
    YesPlayMusicAndroid: {
      request(id, json) {
        nativeRequest = JSON.parse(json);
        if (nativeRequest.url.includes('timeout')) return;
        const status = nativeRequest.url.includes('unauthorized') ? 401 : 200;
        listener({ detail: { id, status, data: '{"code":200}' } });
      },
    },
  };
  const context = vm.createContext({
    axios,
    window,
    Blob,
    FormData,
    FileReader,
    setTimeout,
    clearTimeout,
    console,
  });
  const source = fs
    .readFileSync(path.join(__dirname, '../src/utils/androidApi.js'), 'utf8')
    .replace("import axios from 'axios';", '')
    .replace('export default async function', 'async function');
  vm.runInContext(source + '\nthis.adapter = androidApiAdapter;', context);
  const service = axios.create({
    baseURL: '/api',
    adapter: context.adapter,
    timeout: 1000,
  });
  const response = await service.post(
    '/echo',
    { name: '中文', ids: [1, 2] },
    { params: { cookie: 'MUSIC_U=test;__csrf=token;' } }
  );
  assert.strictEqual(response.data.code, 200);
  assert(nativeRequest.url.startsWith('/api/echo?cookie='));
  assert.deepStrictEqual(JSON.parse(nativeRequest.body), {
    name: '中文',
    ids: [1, 2],
  });
  assert(nativeRequest.headers['Content-Type'].startsWith('application/json'));
  const upload = new Blob([Buffer.from([0, 255, 13, 10])], {
    type: 'image/png',
  });
  upload.name = '头像.png';
  const data = new FormData();
  data.append('filename', '头像');
  data.append('imgFile', upload);
  await service.post('/avatar/upload', data, {
    transformRequest: [value => value],
  });
  const bytes = Buffer.from(nativeRequest.bodyBase64, 'base64');
  assert(bytes.includes(Buffer.from([0, 255, 13, 10])));
  assert(bytes.includes(Buffer.from('name="imgFile"; filename="头像.png"')));
  assert(bytes.includes(Buffer.from('name="filename"\r\n\r\n头像')));
  assert(
    nativeRequest.headers['Content-Type'].startsWith(
      'multipart/form-data; boundary='
    )
  );
  await assert.rejects(
    service.get('/unauthorized'),
    error => error.response.status === 401 && error.response.data.code === 200
  );
  await assert.rejects(
    service.get('/timeout', { timeout: 10 }),
    error => error.code === 'ECONNABORTED'
  );
  assert.strictEqual(vm.runInContext('pending.size', context), 0);
  console.log(
    'Android adapter: JSON, query/cookie, binary multipart, HTTP errors and timeout passed'
  );
}
function get(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let body = '';
      response.on('data', chunk => (body += chunk));
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('error', reject);
    request.setTimeout(500, () => request.destroy(new Error('timeout')));
  });
}
async function testServer() {
  const directory = path.resolve(
    __dirname,
    '../android/app/src/main/assets/api'
  );
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const temporary = fs.mkdtempSync(
    path.resolve(__dirname, '../../android-api-test-')
  );
  // A sibling directory prevents missing dependencies falling back to the repo's node_modules.
  const isolated = path.join(temporary, 'api');
  fs.cpSync(directory, isolated, { recursive: true });
  const child = spawn(process.execPath, [path.join(isolated, 'server.js')], {
    env: { ...process.env, YPM_API_PORT: String(port), TMPDIR: temporary },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let diagnostics = '';
  child.stdout.on('data', chunk => (diagnostics += chunk));
  child.stderr.on('data', chunk => (diagnostics += chunk));
  try {
    const deadline = Date.now() + 20000;
    let health;
    while (Date.now() < deadline && child.exitCode === null) {
      try {
        health = await get(`http://127.0.0.1:${port}/ypm/health`);
        if (health.status === 200) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(
      health && health.status === 200,
      diagnostics || 'API startup timed out'
    );
    assert.strictEqual(
      JSON.parse(health.body).service,
      'yesplaymusic-local-api'
    );
    assert(
      fs.existsSync(path.join(temporary, 'anonymous_token')),
      'Guest token must exist before loading API'
    );
    const missing = await get(`http://127.0.0.1:${port}/ypm/missing-route`);
    assert.strictEqual(missing.status, 404);
    console.log(
      'Bundled API: cold startup, guest token, loopback health and missing route passed'
    );
  } finally {
    child.kill();
    await new Promise(resolve =>
      child.exitCode !== null ? resolve() : child.once('exit', resolve)
    );
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
(async () => {
  await testAdapter();
  if (!process.argv.includes('--adapter-only')) await testServer();
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
