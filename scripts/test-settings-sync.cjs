const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
let files = [
  {
    songId: 99,
    fileName: 'YesPlayMusic-Settings.mp3',
    album: 'Other',
    artist: 'Other',
  },
];
const buffers = new Map();
let nextId = 100,
  corrupt = false,
  rejectDelete = false;
const calls = [];
const source = fs.readFileSync('src/electron/settingsBackup.js', 'utf8');
const names = {
  user_cloud: 'list',
  cloud: 'upload',
  user_cloud_del: 'delete',
  song_download_url: 'url',
  song_url: 'url',
};
const sandbox = {
  module: { exports: {} },
  Buffer,
  URL,
  Set,
  Date,
  require(name) {
    if (name === 'crypto') return crypto;
    if (name === 'axios')
      return async ({ url }) => ({
        data: corrupt
          ? Buffer.from('broken')
          : buffers.get(Number(new URL(url).pathname.slice(1))),
      });
    if (name === './settings-silence.json')
      return JSON.parse(fs.readFileSync('src/electron/settings-silence.json'));
    const kind = names[name.split('/').pop()];
    if (kind) return (query, request) => request(kind, query);
    throw new Error(name);
  },
};
vm.runInNewContext(source, sandbox);
const handler = sandbox.module.exports;
const request = async (kind, query) => {
  calls.push({ kind, query });
  let body = { code: 200 };
  if (kind === 'list') body.data = files.slice();
  if (kind === 'upload') {
    const songId = ++nextId;
    buffers.set(songId, query.songFile.data);
    files.push({
      songId,
      fileName: Buffer.from(query.songFile.name, 'latin1').toString('utf8'),
      artist: 'YesPlayMusic',
      album: 'YesPlayMusic Settings Backup',
      addTime: songId,
    });
    body.songId = 777; // The preliminary upload-check ID is not the published song ID.
    body.privateCloud = { songId };
  }
  if (kind === 'delete') {
    if (rejectDelete) throw new Error('delete failed');
    assert(
      !String(query.id).includes(','),
      'Upstream delete accepts one ID, not a comma-separated batch'
    );
    files = files.filter(file => String(file.songId) !== String(query.id));
  }
  if (kind === 'url')
    body.data = { url: 'https://m701.music.126.net/' + query.id };
  return { body };
};
const settings = {
  themeColor: 'purple',
  lyricFontSize: 28,
  homeSections: ['dailyTracks'],
  customCssUrl: '',
  unmCookie: 'private',
  password: 'secret',
};
const query = operation => ({
  operation,
  settings,
  cookie: { MUSIC_U: 'account' },
});
(async () => {
  assert.equal(calls.length, 0, 'No automatic sync on module load');
  const guest = await handler({ operation: 'export', settings }, request);
  assert.equal(guest.body.code, 500);
  assert.equal(calls.length, 0);
  const bytes = handler.encode(settings);
  const decoded = handler.decode(bytes);
  assert.equal(decoded.settings.themeColor, 'purple');
  assert.equal(decoded.settings.unmCookie, undefined);
  assert.equal(decoded.settings.password, undefined);
  const damaged = Buffer.from(bytes);
  const index = damaged.indexOf(Buffer.from('purple'));
  damaged[index] = 120;
  assert.throws(() => handler.decode(damaged), /校验/);
  // Include several legacy duplicates to exercise the real per-ID delete contract.
  files.push(
    ...[40, 41, 42].map(songId => ({
      songId,
      fileName: 'YesPlayMusic-Settings.mp3',
      artist: 'YesPlayMusic',
      album: 'YesPlayMusic Settings Backup',
    }))
  );
  const generatedNames = new Set();
  for (let i = 0; i < 2; i++) {
    const result = await handler(query('export'), request);
    assert.equal(result.body.code, 200);
    const backup = files.find(file => file.artist === 'YesPlayMusic');
    assert(/^YPM设置备份-[\u4e00-\u9fff]{6}\.mp3$/.test(backup.fileName));
    generatedNames.add(backup.fileName);
    assert.equal(
      files.filter(file => file.artist === 'YesPlayMusic').length,
      1,
      'Only latest verified backup remains'
    );
    assert(
      files.some(file => file.songId === 99),
      'Never delete similarly named user music'
    );
  }
  assert.equal(
    generatedNames.size,
    2,
    'Each export uses a new Chinese filename'
  );
  const imported = await handler(query('import'), request);
  assert.equal(imported.body.snapshot.settings.themeColor, 'purple');
  const before = files.map(file => file.songId).join(',');
  corrupt = true;
  assert.equal((await handler(query('export'), request)).body.code, 500);
  assert.equal(
    files.map(file => file.songId).join(','),
    before,
    'Failed readback rolls back new upload and retains original'
  );
  corrupt = false;
  rejectDelete = true;
  const cleanupFailure = await handler(query('export'), request);
  assert.equal(
    cleanupFailure.body.code,
    200,
    'Verified export is still successful if old cleanup fails'
  );
  assert(cleanupFailure.body.warning.includes('未能清理'));
  assert.equal(
    files.filter(file => file.artist === 'YesPlayMusic').length,
    2,
    'Verified new backup survives failed cleanup'
  );
  rejectDelete = false;
  assert.equal((await handler(query('export'), request)).body.code, 200);
  assert.equal(files.filter(file => file.artist === 'YesPlayMusic').length, 1);
  assert.equal(
    calls.filter(call => call.kind === 'upload').length,
    5,
    'Import never uploads or modifies cloud files'
  );
  console.log(
    'Settings sync: valid tagged MP3, checksum, secret omission, manual roundtrip, random Chinese filenames, published IDs, per-ID cleanup, partial success and rollback passed'
  );
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
