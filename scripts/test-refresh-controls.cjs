const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
function load(file, names, extras = {}) {
  const context = { module: { exports: {} }, ...extras };
  vm.runInNewContext(
    fs
      .readFileSync(file, 'utf8')
      .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
      .replace(/export default /g, '')
      .replace(/export /g, '') + `\nmodule.exports={${names}};`,
    context
  );
  return context.module.exports;
}
const { retainCollection } = load(
  'src/utils/retainedCollections.js',
  'retainCollection'
);
let result = retainCollection(
  [{ id: 2 }],
  [{ id: 1, coverImgUrl: 'saved' }, { id: 2 }]
);
assert.equal(result[1].id, 1);
assert.equal(result[1].archiveStatus, 'removed');
assert.equal(result[1].coverImgUrl, 'saved');
assert.equal(retainCollection([{ id: 1 }], result)[0].archiveStatus, undefined);
assert.equal(
  retainCollection([], [{ id: 1 }], false)[0].archiveStatus,
  undefined,
  'Incomplete pagination cannot mark removals'
);
const { ListeningClock } = load(
  'src/utils/listeningClock.js',
  'ListeningClock'
);
let now = 0;
const clock = new ListeningClock(() => now);
clock.setPlaying(true);
now = 5000;
clock.setPlaying(false);
now = 60000;
assert.equal(clock.seconds(), 5);
clock.setPlaying(true);
now += 3000;
assert.equal(clock.seconds(), 8);
const vue = fs.readFileSync('src/components/PlaylistScrollHandle.vue', 'utf8');
const source = vue
  .match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace('export default', 'module.exports =');
const sandbox = {
  module: { exports: {} },
  document: { addEventListener() {}, removeEventListener() {} },
};
vm.runInNewContext(source, sandbox);
const handle = {
  ...sandbox.module.exports.data(),
  blocked: false,
  scroller: { scrollTop: 500, scrollHeight: 2000, clientHeight: 1000 },
  top: 100,
  height: 400,
  thumbSize: 40,
  progress: 0.5,
  update() {},
  schedule() {},
};
for (const [key, fn] of Object.entries(sandbox.module.exports.methods))
  if (!['update', 'schedule'].includes(key)) handle[key] = fn.bind(handle);
handle.start({ clientY: 287, preventDefault() {} });
assert.equal(
  handle.scroller.scrollTop,
  500,
  'Grabbing the top of the thumb must not jump to its center'
);
handle.move({ clientY: 287, preventDefault() {} });
assert.equal(
  handle.scroller.scrollTop,
  500,
  'First stationary move must retain scroll position'
);
handle.move({ clientY: 323, preventDefault() {} });
assert.equal(handle.scroller.scrollTop, 600);
console.log(
  'Refresh controls: retained collections, partial-page safety, listening clock, no-jump scrollbar passed'
);
