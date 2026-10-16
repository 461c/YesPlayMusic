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

const themeRoot = {},
  themeBody = {};
const paletteContext = {
  document: {
    documentElement: {
      style: { setProperty: (key, value) => (themeRoot[key] = value) },
    },
    body: {
      getAttribute: () => 'light',
      style: { setProperty: (key, value) => (themeBody[key] = value) },
    },
  },
};
vm.createContext(paletteContext);
vm.runInContext(
  common
    .slice(
      common.indexOf('const themeColorPresets'),
      common.indexOf('export function isTrackPlayable')
    )
    .replace(/export /g, ''),
  paletteContext
);
const primaries = new Set();
const neutralPalettes = {};
for (const appearance of ['light', 'dark']) {
  for (const preset of ['default', 'sunset', 'ocean', 'forest']) {
    paletteContext.changeThemeColor(preset, appearance);
    assert.deepEqual(
      themeRoot,
      themeBody,
      'Root and overlays use the same theme tokens'
    );
    assert(
      /^#[0-9a-f]{6}$/i.test(themeBody['--color-primary']),
      'Flat controls must receive a solid color'
    );
    assert.equal(
      themeBody['--color-secondary-bg'],
      appearance === 'dark' ? '#242424' : '#f5f5f5'
    );
    assert(/^rgba\(/.test(themeBody['--color-navbar-bg']));
    assert.equal(
      themeBody['--color-on-primary'],
      '#ffffff',
      'White button glyphs must remain white'
    );
    const neutral = [
      '--color-secondary-bg',
      '--color-secondary-bg-for-transparent',
      '--color-navbar-bg',
      '--color-player-bg',
      '--color-scrollbar-thumb',
    ].map(key => themeBody[key]);
    if (!neutralPalettes[appearance]) neutralPalettes[appearance] = neutral;
    assert.deepEqual(
      neutral,
      neutralPalettes[appearance],
      'All neutral tokens must be identical across accent themes'
    );
    if (appearance === 'light') primaries.add(themeBody['--color-primary']);
    if (appearance === 'dark')
      assert.equal(
        themeBody['--color-player-bg'],
        themeBody['--color-navbar-bg']
      );
    if (preset !== 'default')
      assert(themeBody['--color-primary-gradient'].includes('gradient'));
  }
}
assert.equal(primaries.size, 4);
paletteContext.changeThemeColor('sunset', 'light');
const sunsetSurface = themeBody['--color-secondary-bg'];
paletteContext.changeThemeColor('forest', 'light');
assert.equal(
  themeBody['--color-secondary-bg'],
  sunsetSurface,
  'Neutral surfaces must not follow accent hue'
);
paletteContext.changeThemeColor('unknown', 'light');
assert.equal(
  themeBody['--color-primary'],
  '#335eea',
  'Unknown/removed themes reset every token to default'
);
console.log(
  'Theme palette: four presets, light/dark, global/overlay tokens, neutral surfaces, white glyphs and solid accents passed'
);
