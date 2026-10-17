const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const pins = [];
const context = {
  module: { exports: {} },
  window: {
    YesPlayMusicAndroid: {
      preserveCachedTrack(id) {
        pins.push(id);
        return { 1: 2, 2: 1 }[id] || 0;
      },
    },
  },
  process: { env: {} },
  getTrackSource: async () => null,
};
vm.runInNewContext(
  fs
    .readFileSync('src/utils/retainedTracks.js', 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '')
    .replace(/export /g, '') + '\nmodule.exports={retainTracks};',
  context
);
(async () => {
  const retain = context.module.exports.retainTracks;
  const old = [
    { id: 1, name: 'full', playable: true },
    { id: 2, name: 'partial', playable: true },
    { id: 3, name: 'metadata', playable: true },
  ];
  const result = await retain(
    [{ id: 1, playable: false, privilege: { st: -1 } }],
    old
  );
  assert.equal(result.length, 3);
  assert.equal(result[0].name, 'full');
  assert(result[0].localOnly && result[0].localPlayable);
  assert(result[1].localOnly && !result[1].playable);
  assert(!result[2].localOnly);
  assert.equal(result[2].archiveStatus, 'removed');
  const page = await retain([{ id: 1, playable: true }], old, [
    { id: 1 },
    { id: 2 },
    { id: 3 },
  ]);
  assert.equal(page.length, 1, 'Unloaded tracks are not deleted');
  const ranks = await retain([], old, null, 'not-listed');
  assert(
    ranks.every(song => song.archiveStatus === 'not-listed' && song.playable)
  );
  const revived = await retain(
    [{ id: 1, playable: true, privilege: { pl: 320000 } }],
    result
  );
  assert(!revived[0].localOnly && !revived[0].archiveStatus);
  assert.equal(old[0].localOnly, undefined, 'Do not mutate saved metadata');
  console.log(
    'Retention: full/partial cache, metadata-only tombstones, pagination, ranking omissions and recovery passed'
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
