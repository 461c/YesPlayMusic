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
      path.relative(source, file).split(path.sep)[0] !== 'node_modules',
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
fs.copyFileSync(
  path.join(root, 'android/api/server.js'),
  path.join(output, 'server.js')
);
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
