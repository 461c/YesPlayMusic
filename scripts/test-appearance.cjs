const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
let system = 'light';
const attributes = {};
const root = { style: {} };
const meta = {};
const native = [];
const context = {
  document: {
    body: { setAttribute: (key, value) => (attributes[key] = value) },
    documentElement: root,
    querySelector: () => ({
      setAttribute: (key, value) => (meta[key] = value),
    }),
  },
  systemAppearance: () => system,
  updateAndroidAppearance: (...args) => native.push(args),
};
const common = fs.readFileSync('src/utils/common.js', 'utf8');
vm.createContext(context);
vm.runInContext(
  common
    .slice(
      common.indexOf('export function changeAppearance('),
      common.indexOf('export function splitSoundtrackAlbumTitle(')
    )
    .replace('export ', ''),
  context
);
context.changeAppearance('auto');
assert.equal(root.style.backgroundColor, '#fff');
system = 'dark';
context.changeAppearance('auto');
assert.equal(root.style.backgroundColor, '#000');
assert.equal(root.style.colorScheme, 'dark');
assert.equal(attributes['data-theme'], 'dark');
assert.equal(native.at(-1).join(','), 'dark,auto');
system = 'light';
context.changeAppearance('auto');
assert.equal(root.style.backgroundColor, '#fff');
context.changeAppearance('dark');
assert.equal(
  root.style.backgroundColor,
  '#000',
  'Manual choice must ignore system light'
);
assert.equal(native.at(-1).join(','), 'dark,dark');
const events = {};
let changes = 0;
const listeners = {
  store: { state: { settings: { appearance: 'auto', themeColor: 'default' } } },
  changeAppearance: () => changes++,
  changeThemeColor() {},
  document: {
    hidden: true,
    addEventListener: (name, callback) => (events[name] = callback),
  },
  window: {
    matchMedia: () => ({
      addEventListener: (name, callback) => (events.media = callback),
    }),
    addEventListener: (name, callback) => (events[name] = callback),
  },
};
const store = fs.readFileSync('src/store/index.js', 'utf8');
vm.runInNewContext(
  store.slice(
    store.indexOf('const updateSystemAppearance'),
    store.indexOf('store.watch(')
  ),
  listeners
);
events.media();
events['yesplaymusic-native-environment']();
events.visibilitychange();
assert.equal(changes, 2, 'Hidden tab does not refresh until resumed');
listeners.document.hidden = false;
events.visibilitychange();
assert.equal(changes, 3);
listeners.store.state.settings.appearance = 'light';
events.media();
events.pageshow();
assert.equal(changes, 3, 'System events must preserve a manual preference');
console.log(
  'Appearance: live root/background changes, native preference, foreground refresh and manual choice passed'
);
