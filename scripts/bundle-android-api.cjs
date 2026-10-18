// Copy the API's dependency closure from the existing frozen yarn installation.
// Preserve hoisted/nested package locations so Android uses the same versions.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const modules = path.join(root, 'node_modules');
const output = path.join(root, 'android/app/src/main/assets/api');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const copied = new Set();
function locate(name, from) {
  for (let dir = from; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, 'node_modules', name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
    if (dir === root || dir === path.dirname(dir)) break;
  }
  throw new Error(`Missing locked dependency ${name} from ${from}`);
}
function copyPackage(source) {
  if (copied.has(source)) return;
  if (!source.startsWith(modules + path.sep))
    throw new Error(`Dependency outside installation: ${source}`);
  copied.add(source);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(source, 'package.json'))
  );
  const target = path.join(
    output,
    'node_modules',
    path.relative(modules, source)
  );
  fs.cpSync(source, target, {
    recursive: true,
    filter: file =>
      file === source ||
      (path.relative(source, file).split(path.sep)[0] !== 'node_modules' &&
        !path
          .relative(source, file)
          .split(path.sep)
          .some(part => part.startsWith('.'))),
  });
  for (const name of Object.keys(manifest.dependencies || {}))
    copyPackage(locate(name, source));
  for (const name of Object.keys(manifest.optionalDependencies || {})) {
    try {
      copyPackage(locate(name, source));
    } catch (error) {
      if (!error.message.startsWith('Missing locked dependency')) throw error;
    }
  }
}
copyPackage(locate('@neteaseapireborn/api', root));
// The shared scrobble override lives at the bundle root. Its axios must be
// resolved from there, independently of the API package's nested axios version.
copyPackage(locate('axios', root));
// The upstream module hardcodes 100000 tracks. Keep metadata/trackIds intact,
// but only ask for the first screen's 50 details; the UI pages song/detail on scroll.
const playlistModule = path.join(
  output,
  'node_modules/@neteaseapireborn/api/module/playlist_detail.js'
);
const playlistSource = fs.readFileSync(playlistModule, 'utf8');
if (!playlistSource.includes('n: 100000,'))
  throw new Error('Review upstream playlist pagination before bundling');
fs.writeFileSync(
  playlistModule,
  playlistSource.replace(
    'n: 100000,',
    'n: Math.max(1, Math.min(50, Number(query.n) || 50)),'
  )
);

fs.copyFileSync(
  path.join(root, 'android/api/server.js'),
  path.join(output, 'server.js')
);
// Share the existing clientlog/eapi fix with Electron, not the obsolete upstream weblog.
fs.copyFileSync(
  path.join(root, 'src/electron/scrobble.js'),
  path.join(output, 'scrobble.js')
);
for (const file of [
  'settingsBackup.js',
  'settings-silence.json',
  'ncbl.js',
  'api-enhanced-LICENSE.txt',
]) {
  fs.copyFileSync(
    path.join(root, 'src/electron', file),
    path.join(output, file)
  );
}
const files = [];
function inventory(directory) {
  for (const name of fs.readdirSync(directory).sort()) {
    const file = path.join(directory, name);
    if (fs.statSync(file).isDirectory()) inventory(file);
    else files.push(path.relative(output, file).split(path.sep).join('/'));
  }
}
inventory(output);
const hash = crypto.createHash('sha256');
for (const file of files)
  hash.update(file).update(fs.readFileSync(path.join(output, file)));
fs.writeFileSync(
  path.join(output, 'manifest.json'),
  JSON.stringify({ version: hash.digest('hex'), files })
);
console.log(
  `Bundled ${copied.size} API packages (${files.length} files) from yarn.lock`
);
