const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(
  path.resolve(root, '../android-bundle-fixture-')
);
const fixture = path.join(temporary, 'source');
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function manifest(directory, name, version, dependencies = {}) {
  write(
    path.join(directory, 'package.json'),
    JSON.stringify({ name, version, dependencies, main: 'index.js' })
  );
}
try {
  const api = path.join(fixture, 'node_modules/@neteaseapireborn/api');
  const rootAxios = path.join(fixture, 'node_modules/axios');
  const nestedAxios = path.join(api, 'node_modules/axios');
  manifest(api, '@neteaseapireborn/api', '4.29.7', { axios: '1.7.0' });
  manifest(nestedAxios, 'axios', '1.7.0');
  write(
    path.join(nestedAxios, 'index.js'),
    'module.exports = "nested-api-axios";'
  );
  manifest(rootAxios, 'axios', '0.26.1', { transport: '1.0.0' });
  write(
    path.join(rootAxios, 'index.js'),
    'module.exports = require("transport");'
  );
  const transport = path.join(fixture, 'node_modules/transport');
  manifest(transport, 'transport', '1.0.0');
  write(
    path.join(transport, 'index.js'),
    'module.exports = async () => ({ data: { code: 200 } });'
  );
  write(
    path.join(api, 'module/playlist_detail.js'),
    'module.exports = { n: 100000, };'
  );
  write(
    path.join(api, 'util/crypto.js'),
    'module.exports = { eapi: () => ({params: "test"}) };'
  );
  write(
    path.join(api, 'util/index.js'),
    'module.exports = { generateDeviceId: () => "test" };'
  );
  for (const file of [
    'scripts/bundle-android-api.cjs',
    'android/api/server.js',
    'src/electron/scrobble.js',
    'src/electron/settingsBackup.js',
    'src/electron/settings-silence.json',
  ]) {
    write(path.join(fixture, file), fs.readFileSync(path.join(root, file)));
  }
  execFileSync(
    process.execPath,
    [path.join(fixture, 'scripts/bundle-android-api.cjs')],
    { cwd: fixture }
  );
  // A sibling isolated directory cannot fall back to the fixture's installed dependencies.
  const isolated = path.join(temporary, 'isolated');
  fs.cpSync(path.join(fixture, 'android/app/src/main/assets/api'), isolated, {
    recursive: true,
  });
  const files = JSON.parse(
    fs.readFileSync(path.join(isolated, 'manifest.json'))
  ).files;
  for (const file of [
    'scrobble.js',
    'node_modules/axios/index.js',
    'node_modules/transport/index.js',
    'node_modules/@neteaseapireborn/api/node_modules/axios/index.js',
  ])
    assert(files.includes(file), file);
  const result = execFileSync(
    process.execPath,
    [
      '-e',
      'require(process.argv[1])({id: 1, time: 10}).then(r => { if(r.body.data !== "skipped") process.exit(1); console.log("isolated-scrobble-loaded") })',
      path.join(isolated, 'scrobble.js'),
    ],
    { cwd: isolated, env: { ...process.env, NODE_PATH: '' }, encoding: 'utf8' }
  );
  assert(result.includes('isolated-scrobble-loaded'));
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(isolated, 'node_modules/axios/package.json'))
    ).version,
    '0.26.1'
  );
  assert.equal(
    JSON.parse(
      fs.readFileSync(
        path.join(
          isolated,
          'node_modules/@neteaseapireborn/api/node_modules/axios/package.json'
        )
      )
    ).version,
    '1.7.0'
  );
  console.log(
    'API bundle: isolated scrobble load, root axios closure, nested version and manifest passed'
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
