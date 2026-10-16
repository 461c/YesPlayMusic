const assert = require('assert'),
  fs = require('fs'),
  vm = require('vm');
let observers = [];
class Observer {
  constructor(callback) {
    this.callback = callback;
    observers.push(this);
  }
  observe() {}
  disconnect() {
    this.stopped = true;
  }
}
const attributes = new Set();
const document = {
  documentElement: {
    setAttribute: key => attributes.add(key),
    removeAttribute: key => attributes.delete(key),
  },
};
const context = {
  module: {},
  MutationObserver: Observer,
  setTimeout,
  clearTimeout,
  Promise,
  document,
  getComputedStyle: element => ({ display: element.display || 'block' }),
  window: { matchMedia: () => ({ matches: false }) },
};
vm.runInNewContext(
  fs
    .readFileSync('src/utils/pageTransitions.js', 'utf8')
    .replace(/export /g, '') +
    '\nmodule.exports={waitForPageContent,installPageTransitions};',
  context
);
const { waitForPageContent, installPageTransitions } = context.module.exports;
const tick = () => new Promise(resolve => setImmediate(resolve));
const page = {
  display: 'none',
  dataset: { pageReady: 'false' },
  classList: { contains: () => false },
};
const main = { firstElementChild: page };
const change = () =>
  observers
    .filter(observer => !observer.stopped)
    .forEach(observer => observer.callback());
(async () => {
  let ready = false;
  const pending = waitForPageContent(main, 100).then(() => (ready = true));
  await tick();
  assert.equal(ready, false);
  page.display = 'block';
  change();
  await tick();
  assert.equal(ready, false, 'Wait for the explicit async content marker');
  page.dataset.pageReady = 'true';
  change();
  await pending;
  assert.equal(observers[0].stopped, true);
  page.display = 'none';
  await waitForPageContent(main, 5);
  assert.equal(
    observers.at(-1).stopped,
    true,
    'Timeout releases failed routes'
  );
  let hook,
    removed = false,
    next = 0;
  const router = {
    beforeResolve: callback => ((hook = callback), () => (removed = true)),
  };
  const app = {
    $refs: { main },
    $store: { state: { showLyrics: false } },
    $nextTick: async () => {},
  };
  let dispose = installPageTransitions(router, app);
  hook({}, { name: 'home' }, () => next++);
  assert.equal(next, 1, 'Fallback navigation must not be blocked');
  dispose();
  assert(removed);
  let update,
    finish,
    skipped = false;
  document.startViewTransition = callback => {
    update = callback;
    return {
      ready: Promise.resolve(),
      finished: new Promise(resolve => (finish = resolve)),
      skipTransition: () => (skipped = true),
    };
  };
  dispose = installPageTransitions(router, app);
  hook({}, { name: 'home' }, () => next++);
  assert.equal(
    next,
    1,
    'Capture outgoing content before committing navigation'
  );
  const transition = update();
  await tick();
  assert.equal(next, 2);
  page.display = 'block';
  change();
  await transition;
  finish();
  await tick();
  assert.equal(attributes.size, 0);
  dispose();
  assert(skipped);
  console.log(
    'Page transitions: async readiness, timeout, fallback, snapshot ordering and cleanup passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
