const fs = require('fs'),
  vm = require('vm'),
  assert = require('assert');
function component(path, extra = {}) {
  const code = fs
    .readFileSync(path, 'utf8')
    .split('<script>')[1]
    .split('</script>')[0]
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/^import ['"][^'"]+['"];?/gm, '')
    .replace('export default', 'module.exports =');
  const scope = {
    module: { exports: {} },
    mapState: () => ({}),
    mapActions: () => ({}),
    mapMutations: () => ({}),
    ButtonIcon: {},
    VueSlider: {},
    Cover: {},
    ExplicitSymbol: {},
    isAndroid: true,
    ...extra,
  };
  vm.runInNewContext(code, scope);
  return scope.module.exports;
}
const player = component('src/components/Player.vue');
let model = { settings: { playerButtons: {} } };
assert.equal(player.methods.buttonVisible.call(model, 'previous'), true);
assert.equal(player.computed.forcedButtonClasses.call(model).length, 0);
model.settings.playerButtons = { previous: false, repeat: true, lyrics: false };
assert.equal(player.methods.buttonVisible.call(model, 'previous'), false);
assert.equal(player.methods.buttonVisible.call(model, 'lyrics'), false);
assert.equal(player.methods.buttonVisible.call(model, 'next'), true);
assert.equal(
  player.computed.forcedButtonClasses.call(model).join(','),
  'show-repeat,custom-buttons'
);
const cover = component('src/components/CoverRow.vue');
assert.equal(cover.methods.playCount({ playcount: 123 }), 123);
assert.equal(cover.methods.playCount({ playCount: 456 }), 456);
assert.equal(cover.methods.playCount({ playCount: 0, playcount: 123 }), 0);
assert.equal(cover.methods.playCount({}), undefined);
const options = component('src/components/PlayerButtonSettings.vue');
const state = { playerButtons: { queue: false } };
const control = {
  $store: {
    state: { settings: state },
    commit(type, { key, value }) {
      state[key] = value;
    },
  },
};
options.methods.change.call(control, 'repeat', 'show');
assert.equal(state.playerButtons.repeat, true);
assert.equal(state.playerButtons.queue, false);
options.methods.change.call(control, 'repeat', 'auto');
assert(!Object.prototype.hasOwnProperty.call(state.playerButtons, 'repeat'));
assert.equal(options.methods.value.call(control, 'queue'), 'hide');
console.log(
  'Player options: automatic/show/hide, independent preferences, reset and playlist count variants passed'
);
