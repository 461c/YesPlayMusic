// Exercise ESM evaluation order: syntax/template checks do not catch this failure.
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';
const store = fs.readFileSync('src/store/index.js', 'utf8');
const directAudioImport =
  store.match(
    /import\s+\{[^}]*\}\s+from ['"]@\/utils\/androidAudio['"];?/s
  )?.[0] || '';
const request = fs.readFileSync('src/utils/request.js', 'utf8');
const service = request.match(
  /const service = axios.create\([\s\S]*?\n\}\);/
)[0];
async function boot(android, edge) {
  const files = {
    store: `${edge.replace(
      "'@/utils/androidAudio'",
      "'androidAudio'"
    )}\nimport request from 'request'; export default { state: {} };`,
    androidAudio: fs
      .readFileSync('src/utils/androidAudio.js', 'utf8')
      .replace("'@/utils/auth'", "'auth'"),
    auth: fs
      .readFileSync('src/utils/auth.js', 'utf8')
      .replace("'@/api/auth'", "'apiAuth'")
      .replace("'@/store'", "'store'"),
    apiAuth: "import request from 'request'; export function logout() {}",
    request: `import {isAndroid} from 'androidAudio'; const axios={create: value=>value}; const baseURL='/api'; const androidApiAdapter='native'; ${service}\nexport default service;`,
    'js-cookie': 'export default {};',
  };
  const context = vm.createContext({
    process: { env: { VUE_APP_ANDROID: android ? 'true' : 'false' } },
    window: android ? { YesPlayMusicAndroid: {} } : {},
    performance,
  });
  const modules = Object.fromEntries(
    Object.entries(files).map(([id, code]) => [
      id,
      new vm.SourceTextModule(code, { context, identifier: id }),
    ])
  );
  await modules.store.link(id => modules[id]);
  await modules.store.evaluate();
  return modules.request.namespace.default;
}
for (const android of [true, false]) {
  await assert.rejects(
    boot(android, "import {isAndroid} from '@/utils/androidAudio';"),
    /before initialization/,
    'Negative control must reproduce the black-screen exception'
  );
  const config = await boot(android, directAudioImport);
  assert.equal(
    config.adapter,
    android ? 'native' : undefined,
    'Request adapter must initialize for the correct platform'
  );
}
assert(
  !/^import .*retainedTracks/m.test(
    fs.readFileSync('src/store/actions.js', 'utf8')
  ),
  'Load ranking retention after store initialization'
);
console.log(
  'Startup imports: reproduced old failure; Android and desktop bootstrap and correct API adapters passed'
);
